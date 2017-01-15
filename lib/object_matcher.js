var extend = require('extend');

var ObjectMatcher = function(){
    var log = null;

    this.logger = function(logger){
        log = logger;
    };

    this.match = function(provEvent,pattern){
        if(typeof provEvent != 'object')
            return null;

        var event = extend({},provEvent);
        if(!event.oldState){
            event.oldState={
                value: null
            };
        }

        if(!event.device){
            event.device={};
        }

        if (!pattern.logic) {
            pattern.logic = "and";
        }

        if (!pattern.change) {
            pattern.change = "ne";
        }

        var matched = false;

        // change matching
        if (pattern.change) {
            switch (pattern.change) {
                case "eq":
                    if (event.value == event.oldState.value) {
                        if (pattern.logic == "or") { return true; }
                        matched = true;
                    } else {
                        if (pattern.logic == "and") { return false; }
                    }
                    break;
                case "ne":
                    if (event.value != event.oldState.value) {
                        if (pattern.logic == "or") { return true; }
                        matched = true;
                    } else {
                        if (pattern.logic == "and") { return false; }
                    }
                    break;

                case "gt":
                    if (event.value > event.oldState.value) {
                        if (pattern.logic == "or") { return true; }
                        matched = true;
                    } else {
                        if (pattern.logic == "and") { return false; }
                    }
                    break;
                case "ge":
                    if (event.value >= event.oldState.value) {
                        if (pattern.logic == "or") { return true; }
                        matched = true;
                    } else {
                        if (pattern.logic == "and") { return false; }
                    }
                    break;
                case "lt":
                    if (event.value < event.oldState.value) {
                        if (pattern.logic == "or") { return true; }
                        matched = true;
                    } else {
                        if (pattern.logic == "and") { return false; }
                    }
                    break;
                case "le":
                    if (event.value <= event.oldState.value) {
                        if (pattern.logic == "or") { return true; }
                        matched = true;
                    } else {
                        if (pattern.logic == "and") { return false; }
                    }
                    break;
            }
        }


        // Value Matching
        if (pattern.val !== undefined && pattern.val == event.value) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.val !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.valGt !== undefined && event.value > pattern.valGt) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.valGt !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.valGe !== undefined && event.value >= pattern.valGe) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.valGe !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.valLt !== undefined && event.value < pattern.valLt) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.valLt !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.valLe !== undefined && event.value <= pattern.valLe) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.valLe !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.valNe !== undefined && event.value != pattern.valNe) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.valNe !== undefined) {
            if (pattern.logic == "and") { return false; }
        }

        // Old-Value matching
        if (pattern.oldVal !== undefined && pattern.oldVal == event.oldState.value) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.oldVal !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.oldValGt !== undefined && event.oldState.value > pattern.oldValGt) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.oldValGt !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.oldValGe !== undefined && event.oldState.value >= pattern.oldValGe) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.oldValGe !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.oldValLt !== undefined && event.oldState.value < pattern.oldValLt) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.oldValLt !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.oldValLe !== undefined && event.oldState.value <= pattern.oldValLe) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.oldValLe !== undefined) {
            if (pattern.logic == "and") { return false; }
        }
        if (pattern.oldValNe !== undefined && event.oldState.value != pattern.oldValNe) {
            if (pattern.logic == "or") { return true; }
            matched = true;
        } else if (pattern.oldValNe !== undefined) {
            if (pattern.logic == "and") { return false; }
        }

        // state name matching
        if (pattern.state) {
            if (event.state && event.state.match(generateRegExp(pattern.state))) {
                if (pattern.logic == "or") { return true; }
                matched = true;
            } else {
                if (pattern.logic == "and") { return false; }
            }

        }

        // address matching
        if (pattern.address) {
            if (event.address && event.address.match(generateRegExp(pattern.address))) {
                if (pattern.logic == "or") return true;
                matched = true;
            } else {
                if (pattern.logic == "and") return false;
            }
        }

        // channel matching
        if (pattern.channel) {
            if (event.channel && event.channel.match(generateRegExp(pattern.channel))) {
                if (pattern.logic == "or") return true;
                matched = true;
            } else {
                if (pattern.logic == "and") return false;
            }
        }

        // pluginId matching
        if (pattern.pluginId) {
            if (event.pluginId && event.pluginId.match(generateRegExp(pattern.pluginId))) {
                if (pattern.logic == "or") return true;
                matched = true;
            } else {
                if (pattern.logic == "and") return false;
            }
        }

        // device name matching
        if (typeof pattern.device == 'object' && pattern.device.name) {
            if (event.device && event.device.name && event.device.name.match(generateRegExp(pattern.device.name))) {
                if (pattern.logic == "or") return true;
                matched = true;
            } else {
                if (pattern.logic == "and") return false;
            }
        }

        // device type matching
        if (typeof pattern.device == 'object' && pattern.device.type) {
            if (event.device && event.device.type && event.device.type.match(generateRegExp(pattern.device.type))) {
                if (pattern.logic == "or") return true;
                matched = true;
            } else {
                if (pattern.logic == "and") return false;
            }
        }

        return matched;
    };

    function generateRegExp(filter, prefix, suffix){
        prefix = prefix || "";
        suffix = suffix || "";

        if (Object.prototype.toString.call(filter) == '[object RegExp]')
            return filter;

        var regParts = filter.toString().match(/^\/(.*?)\/([gim]*)$/);
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

module.exports = ObjectMatcher;
