var path = require('path');
var childProcess = require('child_process');
var vm = require('vm');
var extend = require('extend');
var path = require('path');

var scheduler = require('node-schedule');
var uuid = require('node-uuid');
var q = require('q');

var coffeecompiler = require('coffee-script');
var ObjectMatcher = require('./lib/object_matcher.js');

var JavascriptEngine = function(options){
    var log = null;
    var ds = null;
    var pluginmanager = null;
    var scriptDir = null;
    var configDir = null;
    var scripts = {};
    var status = 'stopped';

    var timeout = null;

    var embedded_matchers = [ new ObjectMatcher() ];

    var d = function(){
        var cbThen = function(){};
        var cbFail = function(){};
        var cbFin = function(){};

        var p = {
            resolve: function(data){
                cbThen.call(this,data);
                cbFin.call(this);
            },
            reject: function(error){
                cbFail.call(this,error);
                cbFin.call(this);
            },
            promise: {
                then: function(cb){
                    cbThen = cb;
                    return p;
                },
                fail: function(cb){
                    cbFail = cb;
                    return p;
                },
                fin: function(cb){
                    cbFin = cb;
                    return p;
                }
            }
        };

        return p;
    };

    options.language = options.language || 'javascript';

    this.logger = function(logger){
        log = logger;
    };

    this.datastore = function(datastore){
        ds = datastore;
    };

    this.pluginManager = function(mgr){
        pluginmanager = mgr;
    };

    this.init = function(){
        var scDir = 'scripts';
        var cfgDir = 'config';

        if(!ds.existsSync(scDir)){
            log.warn('Could not find scriptDir ' + scDir + ' - try to create it');
            ds.mkdirSync(scDir);
        }

        if(!ds.existsSync(scDir)){
            log.error('Could not find scriptDir ' + scDir);
            status='error';
        }else{
            scriptDir = scDir;
            checkScriptChanged();
        }

        if(!ds.existsSync(cfgDir)){
            log.warn('Could not find configDir ' + cfgDir + ' - try to create it');
            ds.mkdirSync(cfgDir);
        }

        if(!ds.existsSync(cfgDir)){
            log.error('Could not find configDir ' + cfgDir);
        }else{
            configDir = cfgDir;
        }
    };

    this.start = function(){
        if(status=='stopped'){
            status='starting';
            startAllScripts();
            status='running';
        }
    };

    this.stop = function(){
        if(status=='running'){
            status='stopping';
            if(timeout)
                clearTimeout(timeout);
            stopAllScripts();
            status='stopped';
        }
    };

    this.search = function(query){
        var ret = [];
        query = query.toLowerCase();

        for(var id in scripts){
            var name = scripts[id].name;

            if(name.toLowerCase().indexOf(query)>=0){
                ret.push({
                    id: id,
                    name: name,
                    type: 'script'
                });
            }
        }

        return ret;
    };

    this.searchImage = function(id,size){
        return this.scriptImage(id,size);
    };

    this.scriptList = function(){
        var deferred = q.defer();

        setTimeout(function(){
            var result = [];
            for(var id in scripts){
                result.push({
                    id: id,
                    name: scripts[id].name
                });
            }

            deferred.resolve(result);
        },100);

        return deferred.promise;
    };

    this.scriptGet = function(id){
        var deferred = q.defer();

        setTimeout(function(){
            if(scripts[id]){
                deferred.resolve({
                    id: id,
                    name: scripts[id].name,
                    language: options.language,
                    content: scripts[id].content
                });
            }else{
                deferred.reject("Could not find script with id " + id);
            }
        },100);

        return deferred.promise;
    };

    this.scriptAdd = function(script){
        var deferred = q.defer();
        var id = uuid.v4();
        script = extend(true,{name: 'New script', content: ''},script,{status: 'stopped'});

        setTimeout(function(){
            ds.writeFileJSON(path.join(scriptDir,id + ".script"),{name: script.name, content: script.content}, function(){
                script.mtime = ds.statSync(path.join(scriptDir,id + ".script")).mtime;
                scripts[id] = script;
                startScript(id);

                deferred.resolve({ id: id, name: script.name, content: script.content });
            });
        },100);

        return deferred.promise;
    };

    this.scriptUpdate = function(script){
        var deferred = q.defer();

        setTimeout(function(){
            if(scripts[script.id]){
                stopScript(script.id);

                script = extend(true,scripts[script.id],script,{status: 'stopped'});

                ds.writeFileJSON(path.join(scriptDir,script.id + ".script"),{name: script.name, content: script.content}, function(){
                    script.mtime = ds.statSync(path.join(scriptDir,script.id + ".script")).mtime;
                    scripts[script.id] = script;
                    startScript(script.id);

                    restartImportScripts(script.id);

                    deferred.resolve({ id: script.id, name: script.name, content: script.content });
                });
            }else{
                deferred.reject("Could not find script with id " + script.id);
            }
        },100);

        return deferred.promise;
    };

    this.scriptDelete = function(id){
        var deferred = q.defer();

        setTimeout(function(){
            if(scripts[id]){
                stopScript(id);
                ds.unlinkSync(path.join(scriptDir,id + ".script"));
                delete scripts[id];
                deferred.resolve({ id: id });
            }else{
                deferred.reject("Could not find script with id " + id);
            }
        },100);

        return deferred.promise;
    };

    this.scriptImage = function(){
        if(options.language=='coffeescript'){
            return path.resolve(__dirname,'coffeescript.png');
        }else{
            return path.resolve(__dirname,'javascript.png');
        }
    };

    this.destroy = function(){
        if(timeout){
            clearTimeout(timeout);
            timeout=null;
        }
    };

    this.emitEvent = function(type,data){
        if(type=='state.changed'){
            pluginmanager.getPlugins('matcher').then(function(matchers){
                for(var id in scripts){
                    var script = scripts[id];
                    for(var index1 in script.subscribers){
                        subscriberMatch(script.subscribers[index1],script,data,matchers);
                    }
                }
            });
        }
    };

    function startAllScripts(){
        for(var id in scripts){
            startScript(id);
        }
    }

    function stopAllScripts(){
        for(var id in scripts){
            stopScript(id);
        }
    }

    function startScript(id){
        var script = scripts[id];

        if(status!='running' && status!='starting')
            return;

        if(script){
            log.debug('Start script ' + script.name);

            script.subscribers=[];
            script.schedules=[];
            script.intervals=[];
            script.timeouts=[];

            var sandbox = {
                log: {
                    error: function(msg){ log.error(msg,{submodule: script.name}); },
                    warn: function(msg){ log.warn(msg,{submodule: script.name}); },
                    info: function(msg){ log.info(msg,{submodule: script.name}); },
                    verbose: function(msg){ log.verbose(msg,{submodule: script.name}); },
                    debug: function(msg){ log.debug(msg,{submodule: script.name}); },
                    silly: function(msg){ log.silly(msg,{submodule: script.name}); }
                },

                hmwebui: {
                    getPlugins: function(type,status){
                        var d = q.defer();

                        process.nextTick(function(){
                            if(typeof pluginmanager != "undefined"){
                                pluginmanager.getPlugins(type,status).then(function(result){
                                   d.resolve(result);
                                }).fail(function(err){
                                    d.reject(err);
                                });
                            }else{
                                d.reject('Pluginmanager not found');
                            }
                        });

                        return d.promise;
                    },

                    callPluginFunction: function(pluginId,functionName){
                        var d = q.defer();
                        var args = Array.prototype.slice.call(arguments, 2);

                        process.nextTick(function(){
                            if(typeof pluginmanager != "undefined" && typeof pluginId != "undefined" && typeof functionName != "undefined"){
                                pluginmanager.callPluginFunction(pluginId,functionName,args).then(function(result){
                                    d.resolve(result);
                                }).fail(function(err){
                                    d.reject(err);
                                });
                            }else{
                                d.reject('Pluginmanager not found');
                            }
                        });

                        return d.promise;
                    },

                    getDeviceList: function(selector){
                        var d = q.defer();

                        process.nextTick(function(){
                            var result = [];
                            var attributes = [];
                            var attribute = '';

                            var isAttribute = false;

                            if(selector==null || typeof selector!="string") selector = "";

                            for (var i = 0; i < selector.length; i++) {
                                if(selector[i] == '['){
                                    if(isAttribute)
                                        d.resolve([]);
                                    else{
                                        isAttribute = true;
                                    }

                                }else if(selector[i] == ']'){
                                    if(!isAttribute)
                                        d.resolve([]);
                                    else{
                                        isAttribute = false;
                                        if(attribute.length>1 && attribute.substr(0,1)=="'")
                                            attribute = attribute.substr(1);
                                        if(attribute.length>1 && attribute.substr(attribute.length-1)=="'")
                                            attribute = attribute.substr(0,attribute.length-1);
                                        attributes.push(attribute);
                                        attribute='';
                                    }
                                }else{
                                    if(isAttribute)
                                        attribute+=selector[i];
                                }
                            }

                            if(typeof pluginmanager!="undefined"){
                                pluginmanager.getDeviceList().then(function(deviceList){

                                    deviceList.forEach(function(device){
                                        var pass = true;

                                        attributes.forEach(function(attribute){
                                            var parts = attribute.split("=");
                                            if(parts.length!=2)
                                                pass=false;
                                            else{
                                                if(!device[parts[0].toLowerCase()])
                                                    pass = false;
                                                else{
                                                    var regexp = generateRegExp(parts[1]);
                                                    if(!regexp.test(device[parts[0].toLowerCase()]))
                                                        pass=false;
                                                }
                                            }
                                        });

                                        if(pass)
                                            result.push(device);
                                    });

                                    d.resolve(result);
                                }).fail(function(err){
                                   d.reject(err);
                                });
                            }else{
                                d.reject('Pluginmanager not found');
                            }
                        });

                        return d.promise;
                    },

                    getDevice: function(pluginId,address){
                        var d = q.defer();

                        process.nextTick(function(){
                            if(address==null){
                                address=pluginId;
                                pluginId=null;
                            }

                            if(typeof pluginmanager != "undefined"){
                                pluginmanager.getDevice(pluginId,address,false,false)
                                .then(function(device){
                                    d.resolve(device);
                                })
                                .fail(function(err){
                                    d.reject(err);
                                });
                            }else{
                                d.reject('Pluginmanager not found');
                            }
                        });

                        return d.promise;
                    },

                    getState: function(pluginId,address){
                        var channel = null;
                        var name = null;

                        if(address==null){
                            address=pluginId;
                            pluginId=null;
                        }

                        if(typeof address!="undefined"){
                            if(Array.isArray(address)){
                                var deferred = q.defer();

                                var functions = [];
                                address.forEach(function(addr){
                                    functions.push(sandbox.hmwebui.getState(addr));
                                });

                                q.allSettled(functions).then(function(results){
                                    var ret = [];
                                    results.forEach(function(res){
                                        ret.push(res.value);
                                    });

                                    deferred.resolve(ret);
                                });

                                return deferred.promise;
                            }else if(typeof address == 'object'){
                                var deferredObject = q.defer();

                                var functionsObject = [];
                                var ret = [];
                                for(var key in address){
                                    ret.push({key: key, value: null});
                                    functionsObject.push(sandbox.hmwebui.getState(address[key]));
                                }

                                q.allSettled(functionsObject).then(function(results){
                                    for(var index in results){
                                        ret[index].value=results[index].value;
                                    }

                                    var result = {};
                                    ret.forEach(function(r){
                                        result[r.key] = r.value;
                                    });
                                    deferredObject.resolve(result);
                                });

                                return deferredObject.promise;
                            }else{
                                var split = String(address).split('.');

                                if(split.length==3){
                                    address = split[0];
                                    channel = split[1];
                                    name = split[2];
                                }else if(split.length==2){
                                    address = split[0];
                                    name = split[1];
                                }

                                if(typeof pluginmanager!="undefined"){
                                    return pluginmanager.getState(pluginId,address,channel,name);
                                }
                            }
                        }

                        return null;
                    },

                    setState: function(pluginId,address,value){
                        var d = q.defer();
                        var channel = null;
                        var name = null;

                        if(value==null){
                            value=address;
                            address=pluginId;
                            pluginId=null;
                        }

                        if(typeof address!="undefined"){
                            var split = String(address).split('.');
                            if(split.length==3){
                                address = split[0];
                                channel = split[1];
                                name = split[2];
                            }else if(split.length==2){
                                address = split[0];
                                name = split[1];
                            }

                            if(pluginmanager){
                                pluginmanager.setState(pluginId,address,channel,name,value)
                                .then(function(result){
                                    d.resolve({address: address, channel: channel, name: name, value: result});
                                })
                                .fail(function(err){
                                    d.reject(err);
                                });
                            }
                        }

                        return d.promise;
                    },
                    on: function(pattern){
                        return sandbox.hmwebui.subscribe(pattern);
                    },

                    subscribe: function(pattern){
                        var deferred = d();

                        script.subscribers.push({
                            pattern: pattern,
                            deferred: deferred
                        });

                        return deferred.promise;
                    },

                    schedule: function(pattern){
                        var deferred = d();

                        var sch = scheduler.scheduleJob(pattern, function(){
                            try{
                                deferred.resolve(arguments);
                            }catch(e){
                                sandbox.log.error(e.stack);
                            }
                        });
                        script.schedules.push(sch);
                        deferred.promise.scheduler = sch;

                        return deferred.promise;
                    },

                    exec: function(cmd){
                        sandbox.log.debug("Exec child process " + cmd);
                        return q.ninvoke(childProcess,'exec',cmd);
                    },

                    readConfigJSON: function(file){
                        return q.ninvoke(ds,'readFileJSON',path.join(configDir,file));
                    },

                    writeConfigJSON: function(file, data){
                        return q.ninvoke(ds,'writeFileJSON',path.join(configDir,file),data);
                    }
                },
                setInterval: function(callback,ms){
                    if(ms==null && typeof callback != 'function'){
                        ms = callback;
                        callback = null;
                    }

                    var deferred = d();

                    var argStart = (callback==null) ? 1 : 2;
                    var args = Array.prototype.slice.call(arguments,argStart);
                    var interval = setInterval(function(){
                        try{
                            if(typeof callback == 'function')
                                callback.apply(this,args);
                            deferred.resolve.apply(this,args);
                        }catch(e){
                            sandbox.log.error(e);
                        }
                    },ms);
                    deferred.interval = interval;
                    script.intervals.push(interval);

                    if(callback==null)
                        return deferred.promise;
                    else
                        return interval;
                },
                clearInterval: function(interval){
                    clearInterval(interval);
                    var pos = script.intervals.indexOf(interval);
                    if (pos != -1) {
                        script.intervals.splice(pos, 1);
                    }
                },

                setTimeout: function(callback,ms){
                    if(ms==null && typeof callback != 'function'){
                        ms = callback;
                        callback = null;
                    }

                    var deferred = d();

                    var argStart = (callback==null) ? 1 : 2;
                    var args = Array.prototype.slice.call(arguments,argStart);
                    var timeout = setTimeout(function(){
                        try{
                            if(typeof callback == 'function')
                                callback.apply(this,args);
                            deferred.resolve.apply(this,args);
                        }catch(e){
                            sandbox.log.error(e);
                        }
                    },ms);
                    deferred.timeout = timeout;
                    script.timeouts.push(timeout);

                    if(callback==null)
                        return deferred.promise;
                    else
                        return timeout;
                },
                clearTimeout: function(timeout){
                    clearTimeout(timeout);
                    var pos = script.timeouts.indexOf(timeout);
                    if (pos != -1) {
                        script.timeouts.splice(pos, 1);
                    }
                }
            };

            script.context = new vm.createContext(sandbox);

            try {
                new vm.Script(getScriptContent(id), { displayErrors: false, filename: path.resolve(scriptDir,id + ".script").toString() }).runInContext(script.context);

                script.status='running';
            } catch (e) {
                log.error(e);
                /*if(e.stack){
                    sandbox.log.error(e.stack);
                }else{
                    sandbox.log.error(e);
                }*/
                script.status='error';
            }
        }
    }

    function stopScript(id){
        var script = scripts[id];

        if(script && script.status=='running'){
            log.debug('Stop script ' + script.name);
            for(var scheduleIndex in script.schedules){
                log.silly('Stop scheduler #' + (parseInt(scheduleIndex)+1) + ' for ' + script.name);
                scheduler.cancelJob(script.schedules[scheduleIndex]);
            }

            for(var timeoutIndex in script.timeouts){
                log.silly('Clear timeout #' + (parseInt(timeoutIndex)+1) + ' for ' + script.name);
                clearTimeout(script.timeouts[timeoutIndex]);
            }

            for(var intervalIndex in script.intervals){
                log.silly('Clear interval #' + (parseInt(intervalIndex)+1) + ' for ' + script.name);
                clearInterval(script.intervals[intervalIndex]);
            }

            script.status = 'stopped';
        }
    }

    function restartImportScripts(restartId,scriptIds){
        scriptIds = scriptIds || [];

        if(scriptIds.indexOf(restartId)>=0){
            log.warn("Could not restart script for import - recursion found");
        }else if(scripts[restartId]){
            var name = scripts[restartId].name;
            for(var id in scripts){
                var content = scripts[id].content;
                if(content.indexOf("importScript('" + name + "')")>=0 || content.indexOf('importScript("' + name + '")')>=0){
                    log.silly("Found importScript of '" + name + "' - restart script '" + scripts[id].name + "'");
                    stopScript(id);
                    startScript(id);
                    scriptIds.push(id);
                }
            }
        }
    }

    function checkScriptChanged(){
        if(timeout){
            clearTimeout(timeout);
            timeout=null;
        }

        for(var scriptId in scripts){
            var scriptFiles = ds.readdirSync(scriptDir);
            var found = false;
            for(var scriptIndex in scriptFiles){
                var scriptFile = scriptFiles[scriptIndex];
                if(scriptFile==scriptId + ".script")
                    found = true;
            }

            if(!found){
                log.debug('Script ' + scriptId + ' has been removed - stop script');
                stopScript(scriptId);
            }
        }

        var files = ds.readdirSync(scriptDir);
        for(var index in files){
            var filename = files[index];

            if(path.extname(filename)==".script"){
                var file = path.join(scriptDir,filename);
                var stat = ds.statSync(file);
                if(stat.isFile()){
                    var id = filename.substring(0,filename.lastIndexOf("."));

                    var script = scripts[id];
                    if(!script){
                        log.debug('Found new script file ' + filename);
                        loadScript(filename);
                        startScript(id);
                    }else if(stat.mtime.getTime()!=script.mtime.getTime()){
                        log.debug('Script ' + filename + ' has been changed');
                        loadScript(filename);
                        startScript(id);
                    }
                }
            }
        }

        timeout = setTimeout(function(){
            checkScriptChanged();
        },5000);
    }

    function loadScript(filename){
        var file = path.join(scriptDir,filename);
        if(ds.statSync(file).isFile()){
            var id = filename.substring(0,filename.lastIndexOf("."));

            if(scripts[id])
                stopScript(id);

            log.debug('Load script file ' + filename);

            var stat = ds.statSync(file);
            var content = JSON.parse(ds.readFileSync(file));

            scripts[id]={
                name: content.name,
                content: content.content,
                mtime: stat.mtime
            };
        }
    }

    function getScriptContent(importId,imports){
        imports = imports || [];
        var content = "";
        var name = importId;
        for(var id in scripts){
            if(id==importId || scripts[id].name==importId){
                content = scripts[id].content;
                imports.push(scripts[id].name);
                imports.push(id);
                name = scripts[id].name;
            }
        }

        content = content.replace("\r\n","\n");
        log.debug("Search for imports in script content of '" + name + "'");

        var lines = content.split("\n");
        for(var index in lines){
            var line = lines[index].trim();
            if(line.substr(0,13)=="importScript(" && line.indexOf(")")>14){
                var imp = line.substring(13,line.indexOf(")"));
                imp = imp.trim();
                imp = imp.replace(/"/g,'').replace(/'/g,"");

                if(imp.length>0){
                    log.silly("Found import for '" + imp + "'");
                    if(imports.indexOf(imp)>=0)
                        log.warn("Could not replace import '" + imp + "' - recursive import found");
                    else
                        lines[index] = getScriptContent(imp,imports);
                }
            }
        }

        var ret = lines.join('\n');
        if(options.language=='coffeescript')
            ret = coffeecompiler.compile(ret);

        return ret;
    }

    function subscriberMatch(subscriber,script,data,matchers){
        var matched = false;

        if(embedded_matchers.length>0){
            embedded_matchers.forEach(function(matcher){
                var result = matcher.match(data,subscriber.pattern);
                if(matched===false && result===true && subscriber.deferred && typeof subscriber.deferred.resolve == 'function'){
                    try{
                        subscriber.deferred.resolve(data);
                        matched = true;
                    }catch(e){
                        log.error("Error during subscriber callback - " + e, {submodule: script.name});
                    }
                }
            });
        }

        if(matchers.length>0 && matched===false){
            matchers.forEach(function(matcher){
                pluginmanager.callPluginFunction(matcher.id,'match',[data,subscriber.pattern]).then(function(result){
                    if(matched===false && result===true && subscriber.deferred && typeof subscriber.deferred.resolve == 'function'){
                        try{
                            subscriber.deferred.resolve(data);
                            matched = true;
                        }catch(e){
                            log.error("Error during subscriber callback - " + e, {submodule: script.name});
                        }
                    }
                });
            });
        }
    }

    function generateRegExp(filter, prefix, suffix){
        prefix = prefix || "";
        suffix = suffix || "";

        if (Object.prototype.toString.call(filter) == '[object RegExp]')
            return filter;

        var regParts = filter.match(/^\/(.*?)\/([gim]*)$/);
        if (regParts)
            return new RegExp(prefix.replace(/\./g,"\\.") + regParts[1] + suffix.replace(/\./g,"\\."), regParts[2]);

        if(filter[filter.length-1]!="*"){
            if(suffix!=="")
                suffix += "$";
            else
                filter+= "$";
        }

        if(filter[0]!="*"){
            if(prefix!=="")
                prefix = "^" + prefix;
            else
                filter="^" + filter;
        }

        filter=(prefix + filter + suffix).replace(/\./g,"\\.").replace(/\*/g, ".*");

        return new RegExp(filter);
    }

};

module.exports = JavascriptEngine;
