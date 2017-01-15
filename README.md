![Logo](javascript.png)

# HM WebUI Javascript Plugin

With the plugin you can run Javascript or Coffescript code triggered
by a state change of a device or triggered by a scheduler.

When you write code the following objects / functions support you.

* [Global objects](#global-objects)
 * [log](#log)
 * [hmwebui](#hmwebui)
    * [getPlugins](#getpluginstypestatus)
    * [callPluginFunction](#callpluginfunctionpluginidfunctionnamearg1arg2)
    * [getDeviceList](#getdevicelistselector)
    * [getDevice](#getdevicepluginidaddress)
    * [getState](#getstatepluginidaddress)
    * [setState](#setstatepluginidaddressvalue)
    * [on](#onpattern)
    * [subscribe](#subscribepattern)
    * [schedule](#schedulepattern)
    * [exec](#execcmd)
    * [writeConfigJSON](#writeconfigjsonfiledata)
    * [readConfigJSON](#readconfigjsonfile)
* [Global functions](#global-functions)
  * [importScript](#importscriptname)
  * [setInterval](#setintervalcallbackmsarg1arg2argn)
  * [clearInterval](#clearintervalintervalid)
  * [setTimeout](#settimeoutcallbackmsarg1arg2argn)
  * [clearTimeout](#cleartimeouttimeoutid)
* [Changelog](#changelog)

## Global objects

The follwoing global objects can be used in the code

### log
With the log object functions you can write messages to the log file with
the given severity. The log messages will be written to log file only when
the severity matches to the log level set on the plugin configuration by the user.

When the user set the log level of the plugin to ERROR only messages with
log.error() will be written to the HM WebUI log. If the user set the log level
of the plugin to VERBOSE all higher messages with log.error(), log.warn(),
log.info() and log.verbose() will be written to the log file.

```js
log.error(message)
log.warn(message)
log.info(message)
log.verbose(message)
log.debug(message)
log.silly(message)
```

### hmwebui
The hmwebui object has functions to read or write data from the HM WebUI system
and some supporting function to subscribe to state events or create a scheduler.

All the hmwebui functions return a promise with the following functions:
* .then() - When the request was successful
* .fail() - When an error occurred
* .fin() - Always (if an error occured or the request was successful)

You can combine the functions in the following way:

```js
hmwebui.getPlugins('device').then(function(result){
  ... your code here for successful call
}).fail(function(err){
  ... your code here when an error occurred
}).fin(function(){
  ... your code here that should run always
});
```

#### getPlugins([type],[status])

The getPlugins function is returning a list of configured plugins.

**Parameter**

name | type | required | comment
-|-|-|-
type | string | no | returning all plugins with the given type
status | string | no | possible values: starting, running, stopping, stopped

**Result**

An object with plugin data.
```
{
  id: <unique id of the plugin instance e.g. hm-webui-httprequest.0>,
  pluginId: <the id of the plugin e.g. hm-webui-httprequest>,
  status: <plugin status>
  ...
}
```

**Example**

```js
hmwebui.getPlugins('device').then(function(plugins){
  /*
    the plugins array list contains a list of all device plugins
    with the type 'device'
  */
  ...
});

hmwebui.getPlugins('device','running').then(function(plugins){
  /*
    the plugins array list contains a list of all device plugins
    with the type 'device' that are currently running
  */
  ...
});
```

#### callPluginFunction(pluginId,functionName[,arg1,arg2,...])

The callPluginFunction is used to call a function of a configured plugin.
It depends on the plugin function how many arg[n] parameter you have to provide.
See the documentation of the plugin to see which functions you can call.

**Parameter**

name | type | required | comment
-|-|-|-
pluginId | string | yes | the id of the plugin to call the function (can be retrieved with the getPluginsFunction or is visible in the plugin list of the Admin GUI)
functionName | string | yes | the name of the function to call
arg[n] | any | no | the arguments to call the function (read plugin documentation)

**Result**

Depends on the plugin function (read plugin documentation for details)

**Example**

```js
//call the get function of the httprequest plugin
hmwebui.callPluginFunction('hm-webui-httprequest.0','get','http://www.google.com')
.then(function(result){
  /*
    the result contains the body (html) of the get request
    for more information about the content of the request object
    read the plugin documentation for the hm-webui-httprequest plugin
  */
  ...
})
.fail(function(err){
  //the err contains the error messages
  log.error(err);
});
```

#### getDeviceList(selector)

This function returns a list of devices matching the given selector

**Parameter**

name | type | required | comment
-|-|-|-
selector | string | no | the selector to match the devices (for detailed description see below). If no selector is given all devices are returned

**Selector parameter**

The selector parameter is a string to match the devices. Right now you can match
device attributes. All attributes are combined with a AND condition. The selector should be in the following format:

```
[<attribute>=<value to search for>][<attribute>=<regexp to search for>] ...
```

As attribute value you could provide a string or a regular expression to match a device attribute.

**Result**

An array list containing all matched device objects.

**Example**

```js
//get a list of devices where the type attribute is 'Window'or 'Door'
hmwebui.getDeviceList([type=/Window|Door/]).then(function(list){
  //list is an array list with the device objects matching the selector
  ...
});

/* get a list of devices where the type attribute is 'Window'or 'Door'
    and the pluginId is 'hm-webui-homematic.0' */
hmwebui.getDeviceList([type=/Window|Door/][pluginId='hm-webui-homematic.0']).then(function(list){
  //list is an array list with the device objects matching the selector
  ...
});
```

#### getDevice([pluginId,]address)

This function returns a device object.

**Parameter**

name | type | required | comment
-|-|-|-
pluginId | string | no | the id of the plugin to get the device (can be retrieved with the getPluginsFunction or is visible in the plugin list of the Admin GUI).<br>If no pluginId is provided all plugins will be queried for the given address.

**Result**

An object with the device data

```js
{
    address: <the device address>,
    name: <the name of the device>,
    type: <the type of the device>,
    pluginId: <the plugin id providing the device>,
    channels: {
        ...
    },
    visible: <true or false>,
    editable: <true or false>,
    deletable: <true or false>
    ...
}
```

**Example**

```js
//get the device data for address 'MEQ32546'
hmwebui.getDevice('MEQ32546').then(function(device){
  //device is the device object data
  ...
});

//get the device data for address 'MEQ32546' of the 'hm-webui-homematic.0' plugin
hmwebui.getDevice('hm-webui-homematic.0','MEQ32546').then(function(device){
  //device is the device object data
  ...
});
```

#### getState([pluginId,]address)

With this function you can retrieve one or multiple state value(s)
(depends on the address parameter).

**Parameter**

name | type | required | comment
-|-|-|-
pluginId | string | no | the id of the plugin to call the function (can be retrieved with the getPluginsFunction or is visible in the plugin list of the Admin GUI).<br>If no pluginId is provided all plugins will be queried for the given address.
address | string <br> array <br> object | yes | for detailed description see below

**Address parameter**

If the address is a string it should have the following
format:
```
<device address>.<channel>.<state>
```

You can retrieve one state value with an address parameter
given as string.

If you provide an array of strings as address parameter you retrieve a list of state values
in the same order as the address array. The strings should have the same
format as for a single state address (see above).

If you provide an object it should have the following format:
```js
{
  <key>:<state address>,
  <key1>:<state address1>,
  ...
}
```
The result is an object with key / value pairs. The key is the
key you gave to the address (see above). For the example above the result will be:
```js
{
  <key>:<state value>,
  <key1>:<state value1>,
  ...
}
```

**Example**

```js
//get a single state value for state address 'MEQ32546.1.STATE'
hmwebui.getState('MEQ32546.1.STATE').then(function(state){
  //state contains the value for 'MEQ32546.1.STATE'
  ...
});

//get a single state value for state address 'MEQ32546.1.STATE' of the 'hm-webui-homematic.0' plugin
hmwebui.getState('hm-webui-homematic.0','MEQ32546.1.STATE').then(function(state){
  //state contains the value for 'MEQ32546.1.STATE'
  ...
});

//get a list of state values
hmwebui.getState(['MEQ32546.1.STATE','MEQ88888.1.STATE']).then(function(states){
  /*
    states contains an array list of states in the same order
    as the addresses e.g.
    [1,0]
  */
  ...
});

//get a key / value list of state values
hmwebui.getState({
  state1: 'MEQ32546.1.STATE',
  state2: 'MEQ88888.1.STATE'
}).then(function(states){
  /*
    states contains key / value list of states e.g.
    { state1: 1, state2: 0 }
  */
  ...
});
```

#### setState([pluginId,]address,value)

With this function you can set one or state value for the provided address.

**Parameter**

name | type | required | comment
-|-|-|-
pluginId | string | no | the id of the plugin to call the function (can be retrieved with the getPluginsFunction or is visible in the plugin list of the Admin GUI).<br>If no pluginId is provided all plugins will be queried to set the state for the given address.
address | string | yes | for detailed description see below
value | string <br> number <br> boolean | yes | the value to set

**Address parameter**

The address is a string and should have the following
format:
```
<device address>.<channel>.<state>
```

**Result**

true on success or false on failure

**Example**

```js
//set the state 'MEQ32546.1.STATE' to true
hmwebui.setState('MEQ32546.1.STATE',true).then(function(result){
  //result is true on success or false on failure
  ...
});

//set the state 'MEQ32546.1.STATE' of the 'hm-webui-homematic.0' plugin to 0
hmwebui.setState('hm-webui-homematic.0','MEQ32546.1.STATE',0).then(function(result){
  //result is true on success or false on failure
  ...
});
```

#### on(pattern)
With this function you add a subscription to a state event defined by the given pattern.

**Parameter**

name | type | required | comment
-|-|-|-
pattern | object | yes | a pattern object to define the sate event to subscribe (for detailed description see below / Object matcher)

**Object matcher**

You have to provide an object (key / value pairs) as pattern with the following
possible parameter.

key | type | comment
-|-|-
logic | string | logic to combine the condition keys. Possible values are <br>**and** (default) <br>**or**
change | string | possible values are <br> **ne** (default) - (not equal) New value must be not equal to the old one (value != oldState.value) <br> **eq** - (equal) New value must be equal to old one (value == oldState.value) <br> **gt** - (greater than) New value must be greater than old value (value > oldState.value) <br> **ge** - (greater or equal) New value must be greater or equal to old one (value >= oldState.value) <br> **lt** - (lower than) New value must be lower than old one (value < oldState.value) <br> **le** - (lower or equal) New value must be lower or equal to old value (value <= oldState.value)
val | any | New value must be equal to the given value
valNe | any | New value must be not equal to the given value
valGt | any | New value must be greater than the given value
valGe | any | New value must be greater than or equal to the given value
valLt | any | New value must be lower than the given value
valLe | any | New value must be lower than or equal to the given value
oldVal | any | Old value must be equal to the given value
oldValNe | any | Old value must be not equal to the given value
oldValGt | any | Old value must be greater than the given value
oldValGe | any | Old value must be greater than or equal to the given value
oldValLt | any | Old value must be lower than the given value
oldValLe | any | Old value must be lower than or equal to the given value
state | string <br> RegExp | The state id of the event must match the given string or regular expression. <br><br> The string can have a \* at the beginning and/or end e.g. <br> ST\*  - to match all states beginning with ST <br> \*AT - to match all states ending with AT
address | string <br> RegExp | The address of the event must match the given string or regular expression. <br><br> The string can have a \* at the beginning and/or end e.g. <br> ADDR\*  - to match all addresses beginning with ADDR <br> \*ESS - to match all addresses ending with ESS
channel | string <br> RegExp | The channel of the event must match the given string or regular expression. <br><br> The string can have a \* at the beginning and/or end e.g. <br> CHA\*  - to match all channels beginning with CHA <br> \*NNEL - to match all channels ending with NNEL
pluginId | string <br> RegExp | The pluginId of the event must match the given string or regular expression. <br><br> The string can have a \* at the beginning and/or end e.g. <br> hm-webui\*  - to match all pluginIds beginning with hm-webui <br> \*httprequest - to match all pluginIds ending with httprequest
device | object | a object to match device values of the event with the following keys: <br>**name** - a string or RegExp. The device name of the event must match the given name <br>**type** - a string or RegExp. The device type of the event must match the given type

**Result**

The result is an event object. It depends on the device plugin what kind of information is provided for the event but at least the following fields should be in the object:

```
{
  address: <device address>,
  channel: <channel id>,
  state: <state id>,
  value: <state new value>,
  timestamp: <value change timestamp as unix timestamp>,
  oldState: <object containing the old state | optional>,
  device: <object with detailed device data | optional>
}
```

**Example**

```js
//match all events where the state starts with STA* and the device type matches the given regular expression
hmwebui.on({ state: 'STA*', device: { type: /HM-Sec-SCo/ } }).then(function(event){
  //result is an event object
  ...
});

//match all events where state is STATE and the new value is true
hmwebui.on({ state: 'STATE', val: true }).then(function(event){
  //result is an event object
  ...
});

//match all events where state is STATE and the new value is greater than the old value
hmwebui.on({ state: 'STATE', change: 'gt' }).then(function(event){
  //result is an event object
  ...
});
```

#### subscribe(pattern)

Alias for the [on(pattern)](#on-pattern-) function

#### schedule(pattern)

Schedule a function to run on the given pattern.

**Parameter**

name | type | required | comment
-|-|-|-
pattern | string <br> object | yes | see Cron expression and Object expression below for details

For more details on the expressions visit the [nodejs-schedule project page](https://github.com/node-schedule/node-schedule)

**Cron expression**

The pattern can be a cron expression in the following format
```
*    *    *    *    *    *
┬    ┬    ┬    ┬    ┬    ┬
│    │    │    │    │    |
│    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
│    │    │    │    └───── month (1 - 12)
│    │    │    └────────── day of month (1 - 31)
│    │    └─────────────── hour (0 - 23)
│    └──────────────────── minute (0 - 59)
└───────────────────────── second (0 - 59, OPTIONAL)
```

```js
hmwebui.schedule('*/5 * * * *').then(function(){
  //the function is called every 5 minutes
});
```

**Object expression**

To make things a little easier, an object expression is also supported.

```js
hmwebui.schedule({hour: 14, minute: 30, dayOfWeek: 0}).then(function(){
  //the function is called every Sunday at 2:30pm
});
```

**Returns**

As all other functions the schedule function returns a promise with .then() .fail()
and .fin() functions. But ist also has a scheduler property holding the instance of the schedule.
This is e.g. needed if you want to cancel a schedule.

```js
var sched = hmwebui.schedule({hour: 14, minute: 30, dayOfWeek: 0}).then(function(){
  //the function is called every Sunday at 2:30pm
});

//cancel the scheduler
sched.scheduler.cancel()
```

#### exec(cmd)

Execute a command on the system HM WebUi is running on.

**Parameter**

name | type | required | comment
-|-|-|-
cmd | string | yes | the command to execute e.g. <br> ls /var/log - to list files in the /var/log directory

**Result**

the ouput of the system command

**Example**

```js
hmwebui.exec('ls /var/log').then(function(result){
  //result holds the output of the command (stdout)
}).fail(function(err){
  //err contains the error returned by the command if something failed
});
```

#### writeConfigJSON(file,data)

Write an data to the config store of the plugin instance.

**Parameter**

name | type | required | comment
-|-|-|-
file | string | yes | the filename of the config file to write to
data | object | yes | the object data to write to the config stopServer

**Example**

```js
hmwebui.writeConfigJSON('test.json',{id: 1, name: 'Test'}).then(function(){
  //there is no result on success
}).fail(function(err){
  //error message when something went wrong
});
```

#### readConfigJSON(file)

Read a JSON object from the config store of the plugin instance.

**Parameter**

name | type | required | comment
-|-|-|-
file | string | yes | the filename of the config file to read

**Result**

a JSON object from the config file

**Example**

```js
hmwebui.readConfigJSON('test.json').then(function(result){
  //result is the JSON object from the config file
}).fail(function(err){
  //error message when something went wrong
});
```

## Global functions

The follwoing global functions can be used in the code

#### importScript(name)

This function can be used in a script to import another script in the same plugin.
It is not possible to import scripts of other plugins. The code of the imported script
will be copied to the position where the importScript()  function is in the code.

To avoid confusion on an error put the importScript() function always at the end
of the main code (the line numbers could be different in the error message when you import the
script in the middle of the code).

**Parameter**

name | type | required | comment
-|-|-|-
name | string | yes | the name of the script to import

**Example**

```js
//import the script 'Test Script' here
importScript('Test Script');
```

#### setInterval([callback,],ms[,arg1,arg2,...,argN])

The method calls a function or evaluates an expression at specified intervals (in milliseconds).

For support of the javascript standard setInterval function you can provide as first argument a callback. If you omit the timeout the function is returning a promise that is called after the milliseconds.

**Parameter**

name | type | required | comment
-|-|-|-
callback | function | no | the function to execute; as argruments the arg1 ... argN is passed to the function
ms | integer | yes | the milliseconds to repeat the code

**Returns**

If a callback function is provided it returns the id of the interval. If no callback function is
provided it returns a promise and the .then() function of the promise is called on every interval. The arguments passed to the .then() function are the arg1 ... argN. The promise also contains a reference to the interval id.

```js
var intervalId = setInterval(10).interval;
```

**Example**

```js
//run the function every 5 seconds
var intervalId = setInterval(function(){
    log.info('Five seconds are over');
},5000);

//run the function every 5 seconds
var intervalId = setInterval(5000).then(function(){
    log.info('Five seconds are over');
}).interval;
```

#### clearInterval(intervalId)

This method deletes an interval

**Parameter**

name | type | required | comment
-|-|-|-
intervalId | integer | yes | the the id of the interval returned by the [setInterval](#setinterval-callback-ms-arg1-arg2-argn-) function

**Example**

```js
//run the function after 5 seconds
var intervalId = setInterval(5000).then(function(){
    log.info('Five seconds are over');
}).interval;

//clear the interval
clearInterval(intervalId);
```

#### setTimeout([callback,],ms[,arg1,arg2,...,argN])

The method calls a function or evaluates an expression after a specified number of milliseconds.
For support of the javascript standard setTimeout function you can provide as first argument a callback. If you omit the timeout the function is returning a promise that is called after the milliseconds

**Parameter**

name | type | required | comment
-|-|-|-
callback | function | no | the function to execute; as argruments the arg1 ... argN is passed to the function
ms | integer | yes | the number of milliseconds to wait before executing the code

**Returns**

If a callback function is provided it returns the id of the timeout. If no callback function is
provided it returns a promise and the .then() function of the promise is called after
the timeout. The arguments passed to the .then() function are the arg1 ... argN. The promise also contains a reference to the timeout id.

```js
var timeoutId = setTimeout(10).timeout;
```

**Example**

```js
//run the function after 5 seconds
var timeoutId = setTimeout(function(){
    log.info('Five seconds are over');
},5000);

//run the function after 5 seconds
var timeoutId = setTimeout(5000).then(function(){
    log.info('Five seconds are over');
}).timeout;
```

#### clearTimeout(timeoutId)

This method deletes a timeout

**Parameter**

name | type | required | comment
-|-|-|-
timeoutId | integer | yes | the the id of the timeout returned by the [setTimeout](#settimeout-callback-ms-arg1-arg2-argn-) function

**Example**

```js
//run the function after 5 seconds
var timeoutId = setTimeout(5000).then(function(){
    log.info('Five seconds are over');
}).timeout;

//clear the timeout
clearTimeout(timeoutId);
```

## Changelog

0.0.1 (2017-01-08)
* initial version
