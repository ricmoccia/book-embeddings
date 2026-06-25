var Module=typeof Module!="undefined"?Module:{};var ENVIRONMENT_IS_WEB=!!globalThis.window;var ENVIRONMENT_IS_WORKER=!!globalThis.WorkerGlobalScope;var ENVIRONMENT_IS_NODE=globalThis.process?.versions?.node&&globalThis.process?.type!="renderer";var arguments_=[];var thisProgram="./this.program";var quit_=(status,toThrow)=>{throw toThrow};var _scriptName=globalThis.document?.currentScript?.src;if(typeof __filename!="undefined"){_scriptName=__filename}else if(ENVIRONMENT_IS_WORKER){_scriptName=self.location.href}var scriptDirectory="";function locateFile(path){if(Module["locateFile"]){return Module["locateFile"](path,scriptDirectory)}return scriptDirectory+path}var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){var fs=require("fs");scriptDirectory=__dirname+"/";readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename);return ret};readAsync=async(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename,binary?undefined:"utf8");return ret};if(process.argv.length>1){thisProgram=process.argv[1].replace(/\\/g,"/")}arguments_=process.argv.slice(2);if(typeof module!="undefined"){module["exports"]=Module}quit_=(status,toThrow)=>{process.exitCode=status;throw toThrow}}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){try{scriptDirectory=new URL(".",_scriptName).href}catch{}{if(ENVIRONMENT_IS_WORKER){readBinary=url=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)}}readAsync=async url=>{if(isFileURI(url)){return new Promise((resolve,reject)=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,true);xhr.responseType="arraybuffer";xhr.onload=()=>{if(xhr.status==200||xhr.status==0&&xhr.response){resolve(xhr.response);return}reject(xhr.status)};xhr.onerror=reject;xhr.send(null)})}var response=await fetch(url,{credentials:"same-origin"});if(response.ok){return response.arrayBuffer()}throw new Error(response.status+" : "+response.url)}}}else{}var out=console.log.bind(console);var err=console.error.bind(console);var wasmBinary;var ABORT=false;var EXITSTATUS;var isFileURI=filename=>filename.startsWith("file://");var HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;var HEAP64,HEAPU64;var runtimeInitialized=false;function updateMemoryViews(){var b=wasmMemory.buffer;HEAP8=new Int8Array(b);HEAP16=new Int16Array(b);HEAPU8=new Uint8Array(b);HEAPU16=new Uint16Array(b);HEAP32=new Int32Array(b);HEAPU32=new Uint32Array(b);HEAPF32=new Float32Array(b);HEAPF64=new Float64Array(b);HEAP64=new BigInt64Array(b);HEAPU64=new BigUint64Array(b)}function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(onPreRuns)}function initRuntime(){runtimeInitialized=true;if(!Module["noFSInit"]&&!FS.initialized)FS.init();TTY.init();wasmExports["W"]();FS.ignorePermissions=false}function preMain(){}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(onPostRuns)}function abort(what){Module["onAbort"]?.(what);what="Aborted("+what+")";err(what);ABORT=true;what+=". Build with -sASSERTIONS for more info.";var e=new WebAssembly.RuntimeError(what);throw e}var wasmBinaryFile;function findWasmBinary(){return locateFile("binary.wasm")}function getBinarySync(file){if(file==wasmBinaryFile&&wasmBinary){return new Uint8Array(wasmBinary)}if(readBinary){return readBinary(file)}throw"both async and sync fetching of the wasm failed"}async function getWasmBinary(binaryFile){if(!wasmBinary){try{var response=await readAsync(binaryFile);return new Uint8Array(response)}catch{}}return getBinarySync(binaryFile)}async function instantiateArrayBuffer(binaryFile,imports){try{var binary=await getWasmBinary(binaryFile);var instance=await WebAssembly.instantiate(binary,imports);return instance}catch(reason){err(`failed to asynchronously prepare wasm: ${reason}`);abort(reason)}}async function instantiateAsync(binary,binaryFile,imports){if(!binary&&!isFileURI(binaryFile)&&!ENVIRONMENT_IS_NODE){try{var response=fetch(binaryFile,{credentials:"same-origin"});var instantiationResult=await WebAssembly.instantiateStreaming(response,imports);return instantiationResult}catch(reason){err(`wasm streaming compile failed: ${reason}`);err("falling back to ArrayBuffer instantiation")}}return instantiateArrayBuffer(binaryFile,imports)}function getWasmImports(){var imports={a:wasmImports};return imports}async function createWasm(){function receiveInstance(instance,module){wasmExports=instance.exports;assignWasmExports(wasmExports);updateMemoryViews();removeRunDependency("wasm-instantiate");return wasmExports}addRunDependency("wasm-instantiate");function receiveInstantiationResult(result){return receiveInstance(result["instance"])}var info=getWasmImports();if(Module["instantiateWasm"]){return new Promise((resolve,reject)=>{Module["instantiateWasm"](info,(inst,mod)=>{resolve(receiveInstance(inst,mod))})})}wasmBinaryFile??=findWasmBinary();var result=await instantiateAsync(wasmBinary,wasmBinaryFile,info);var exports=receiveInstantiationResult(result);return exports}class ExitStatus{name="ExitStatus";constructor(status){this.message=`Program terminated with exit(${status})`;this.status=status}}var callRuntimeCallbacks=callbacks=>{while(callbacks.length>0){callbacks.shift()(Module)}};var onPostRuns=[];var addOnPostRun=cb=>onPostRuns.push(cb);var onPreRuns=[];var addOnPreRun=cb=>onPreRuns.push(cb);var runDependencies=0;var dependenciesFulfilled=null;var removeRunDependency=id=>{runDependencies--;Module["monitorRunDependencies"]?.(runDependencies);if(runDependencies==0){if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback()}}};var addRunDependency=id=>{runDependencies++;Module["monitorRunDependencies"]?.(runDependencies)};var noExitRuntime=true;var stackRestore=val=>__emscripten_stack_restore(val);var stackSave=()=>_emscripten_stack_get_current();var exceptionCaught=[];var uncaughtExceptionCount=0;var ___cxa_begin_catch=ptr=>{var info=new ExceptionInfo(ptr);if(!info.get_caught()){info.set_caught(true);uncaughtExceptionCount--}info.set_rethrown(false);exceptionCaught.push(info);___cxa_increment_exception_refcount(ptr);return ___cxa_get_exception_ptr(ptr)};var exceptionLast=0;var ___cxa_end_catch=()=>{_setThrew(0,0);var info=exceptionCaught.pop();___cxa_decrement_exception_refcount(info.excPtr);exceptionLast=0};class ExceptionInfo{constructor(excPtr){this.excPtr=excPtr;this.ptr=excPtr-24}set_type(type){HEAPU32[this.ptr+4>>2]=type}get_type(){return HEAPU32[this.ptr+4>>2]}set_destructor(destructor){HEAPU32[this.ptr+8>>2]=destructor}get_destructor(){return HEAPU32[this.ptr+8>>2]}set_caught(caught){caught=caught?1:0;HEAP8[this.ptr+12]=caught}get_caught(){return HEAP8[this.ptr+12]!=0}set_rethrown(rethrown){rethrown=rethrown?1:0;HEAP8[this.ptr+13]=rethrown}get_rethrown(){return HEAP8[this.ptr+13]!=0}init(type,destructor){this.set_adjusted_ptr(0);this.set_type(type);this.set_destructor(destructor)}set_adjusted_ptr(adjustedPtr){HEAPU32[this.ptr+16>>2]=adjustedPtr}get_adjusted_ptr(){return HEAPU32[this.ptr+16>>2]}}var setTempRet0=val=>__emscripten_tempret_set(val);var findMatchingCatch=args=>{var thrown=exceptionLast;if(!thrown){setTempRet0(0);return 0}var info=new ExceptionInfo(thrown);info.set_adjusted_ptr(thrown);var thrownType=info.get_type();if(!thrownType){setTempRet0(0);return thrown}for(var caughtType of args){if(caughtType===0||caughtType===thrownType){break}var adjusted_ptr_addr=info.ptr+16;if(___cxa_can_catch(caughtType,thrownType,adjusted_ptr_addr)){setTempRet0(caughtType);return thrown}}setTempRet0(thrownType);return thrown};var ___cxa_find_matching_catch_2=()=>findMatchingCatch([]);var ___cxa_find_matching_catch_3=arg0=>findMatchingCatch([arg0]);var ___cxa_rethrow=()=>{var info=exceptionCaught.pop();if(!info){abort("no exception to throw")}var ptr=info.excPtr;if(!info.get_rethrown()){exceptionCaught.push(info);info.set_rethrown(true);info.set_caught(false);uncaughtExceptionCount++}exceptionLast=ptr;throw exceptionLast};var ___cxa_throw=(ptr,type,destructor)=>{var info=new ExceptionInfo(ptr);info.init(type,destructor);exceptionLast=ptr;uncaughtExceptionCount++;throw exceptionLast};var ___cxa_uncaught_exceptions=()=>uncaughtExceptionCount;var ___resumeException=ptr=>{if(!exceptionLast){exceptionLast=ptr}throw exceptionLast};var syscallGetVarargI=()=>{var ret=HEAP32[+SYSCALLS.varargs>>2];SYSCALLS.varargs+=4;return ret};var syscallGetVarargP=syscallGetVarargI;var PATH={isAbs:path=>path.charAt(0)==="/",splitPath:filename=>{var splitPathRe=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;return splitPathRe.exec(filename).slice(1)},normalizeArray:(parts,allowAboveRoot)=>{var up=0;for(var i=parts.length-1;i>=0;i--){var last=parts[i];if(last==="."){parts.splice(i,1)}else if(last===".."){parts.splice(i,1);up++}else if(up){parts.splice(i,1);up--}}if(allowAboveRoot){for(;up;up--){parts.unshift("..")}}return parts},normalize:path=>{var isAbsolute=PATH.isAbs(path),trailingSlash=path.slice(-1)==="/";path=PATH.normalizeArray(path.split("/").filter(p=>!!p),!isAbsolute).join("/");if(!path&&!isAbsolute){path="."}if(path&&trailingSlash){path+="/"}return(isAbsolute?"/":"")+path},dirname:path=>{var result=PATH.splitPath(path),root=result[0],dir=result[1];if(!root&&!dir){return"."}if(dir){dir=dir.slice(0,-1)}return root+dir},basename:path=>path&&path.match(/([^\/]+|\/)\/*$/)[1],join:(...paths)=>PATH.normalize(paths.join("/")),join2:(l,r)=>PATH.normalize(l+"/"+r)};var initRandomFill=()=>{if(ENVIRONMENT_IS_NODE){var nodeCrypto=require("crypto");return view=>nodeCrypto.randomFillSync(view)}return view=>crypto.getRandomValues(view)};var randomFill=view=>{(randomFill=initRandomFill())(view)};var PATH_FS={resolve:(...args)=>{var resolvedPath="",resolvedAbsolute=false;for(var i=args.length-1;i>=-1&&!resolvedAbsolute;i--){var path=i>=0?args[i]:FS.cwd();if(typeof path!="string"){throw new TypeError("Arguments to path.resolve must be strings")}else if(!path){return""}resolvedPath=path+"/"+resolvedPath;resolvedAbsolute=PATH.isAbs(path)}resolvedPath=PATH.normalizeArray(resolvedPath.split("/").filter(p=>!!p),!resolvedAbsolute).join("/");return(resolvedAbsolute?"/":"")+resolvedPath||"."},relative:(from,to)=>{from=PATH_FS.resolve(from).slice(1);to=PATH_FS.resolve(to).slice(1);function trim(arr){var start=0;for(;start<arr.length;start++){if(arr[start]!=="")break}var end=arr.length-1;for(;end>=0;end--){if(arr[end]!=="")break}if(start>end)return[];return arr.slice(start,end-start+1)}var fromParts=trim(from.split("/"));var toParts=trim(to.split("/"));var length=Math.min(fromParts.length,toParts.length);var samePartsLength=length;for(var i=0;i<length;i++){if(fromParts[i]!==toParts[i]){samePartsLength=i;break}}var outputParts=[];for(var i=samePartsLength;i<fromParts.length;i++){outputParts.push("..")}outputParts=outputParts.concat(toParts.slice(samePartsLength));return outputParts.join("/")}};var UTF8Decoder=globalThis.TextDecoder&&new TextDecoder;var findStringEnd=(heapOrArray,idx,maxBytesToRead,ignoreNul)=>{var maxIdx=idx+maxBytesToRead;if(ignoreNul)return maxIdx;while(heapOrArray[idx]&&!(idx>=maxIdx))++idx;return idx};var UTF8ArrayToString=(heapOrArray,idx=0,maxBytesToRead,ignoreNul)=>{var endPtr=findStringEnd(heapOrArray,idx,maxBytesToRead,ignoreNul);if(endPtr-idx>16&&heapOrArray.buffer&&UTF8Decoder){return UTF8Decoder.decode(heapOrArray.subarray(idx,endPtr))}var str="";while(idx<endPtr){var u0=heapOrArray[idx++];if(!(u0&128)){str+=String.fromCharCode(u0);continue}var u1=heapOrArray[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}var u2=heapOrArray[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2}else{u0=(u0&7)<<18|u1<<12|u2<<6|heapOrArray[idx++]&63}if(u0<65536){str+=String.fromCharCode(u0)}else{var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}}return str};var FS_stdin_getChar_buffer=[];var lengthBytesUTF8=str=>{var len=0;for(var i=0;i<str.length;++i){var c=str.charCodeAt(i);if(c<=127){len++}else if(c<=2047){len+=2}else if(c>=55296&&c<=57343){len+=4;++i}else{len+=3}}return len};var stringToUTF8Array=(str,heap,outIdx,maxBytesToWrite)=>{if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.codePointAt(i);if(u<=127){if(outIdx>=endIdx)break;heap[outIdx++]=u}else if(u<=2047){if(outIdx+1>=endIdx)break;heap[outIdx++]=192|u>>6;heap[outIdx++]=128|u&63}else if(u<=65535){if(outIdx+2>=endIdx)break;heap[outIdx++]=224|u>>12;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63}else{if(outIdx+3>=endIdx)break;heap[outIdx++]=240|u>>18;heap[outIdx++]=128|u>>12&63;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63;i++}}heap[outIdx]=0;return outIdx-startIdx};var intArrayFromString=(stringy,dontAddNull,length)=>{var len=length>0?length:lengthBytesUTF8(stringy)+1;var u8array=new Array(len);var numBytesWritten=stringToUTF8Array(stringy,u8array,0,u8array.length);if(dontAddNull)u8array.length=numBytesWritten;return u8array};var FS_stdin_getChar=()=>{if(!FS_stdin_getChar_buffer.length){var result=null;if(ENVIRONMENT_IS_NODE){var BUFSIZE=256;var buf=Buffer.alloc(BUFSIZE);var bytesRead=0;var fd=process.stdin.fd;try{bytesRead=fs.readSync(fd,buf,0,BUFSIZE)}catch(e){if(e.toString().includes("EOF"))bytesRead=0;else throw e}if(bytesRead>0){result=buf.slice(0,bytesRead).toString("utf-8")}}else if(globalThis.window?.prompt){result=window.prompt("Input: ");if(result!==null){result+="\n"}}else{}if(!result){return null}FS_stdin_getChar_buffer=intArrayFromString(result,true)}return FS_stdin_getChar_buffer.shift()};var TTY={ttys:[],init(){},shutdown(){},register(dev,ops){TTY.ttys[dev]={input:[],output:[],ops};FS.registerDevice(dev,TTY.stream_ops)},stream_ops:{open(stream){var tty=TTY.ttys[stream.node.rdev];if(!tty){throw new FS.ErrnoError(43)}stream.tty=tty;stream.seekable=false},close(stream){stream.tty.ops.fsync(stream.tty)},fsync(stream){stream.tty.ops.fsync(stream.tty)},read(stream,buffer,offset,length,pos){if(!stream.tty||!stream.tty.ops.get_char){throw new FS.ErrnoError(60)}var bytesRead=0;for(var i=0;i<length;i++){var result;try{result=stream.tty.ops.get_char(stream.tty)}catch(e){throw new FS.ErrnoError(29)}if(result===undefined&&bytesRead===0){throw new FS.ErrnoError(6)}if(result===null||result===undefined)break;bytesRead++;buffer[offset+i]=result}if(bytesRead){stream.node.atime=Date.now()}return bytesRead},write(stream,buffer,offset,length,pos){if(!stream.tty||!stream.tty.ops.put_char){throw new FS.ErrnoError(60)}try{for(var i=0;i<length;i++){stream.tty.ops.put_char(stream.tty,buffer[offset+i])}}catch(e){throw new FS.ErrnoError(29)}if(length){stream.node.mtime=stream.node.ctime=Date.now()}return i}},default_tty_ops:{get_char(tty){return FS_stdin_getChar()},put_char(tty,val){if(val===null||val===10){getDataFromWasm(UTF8ArrayToString(tty.output));tty.output=[]}else{if(val!=0)tty.output.push(val)}},fsync(tty){if(tty.output?.length>0){getDataFromWasm(UTF8ArrayToString(tty.output));tty.output=[]}},ioctl_tcgets(tty){return{c_iflag:25856,c_oflag:5,c_cflag:191,c_lflag:35387,c_cc:[3,28,127,21,4,0,1,0,17,19,26,0,18,15,23,22,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}},ioctl_tcsets(tty,optional_actions,data){return 0},ioctl_tiocgwinsz(tty){return[24,80]}},default_tty1_ops:{put_char(tty,val){if(val===null||val===10){err(UTF8ArrayToString(tty.output));tty.output=[]}else{if(val!=0)tty.output.push(val)}},fsync(tty){if(tty.output?.length>0){err(UTF8ArrayToString(tty.output));tty.output=[]}}}};var mmapAlloc=size=>{abort()};var MEMFS={ops_table:null,mount(mount){return MEMFS.createNode(null,"/",16895,0)},createNode(parent,name,mode,dev){if(FS.isBlkdev(mode)||FS.isFIFO(mode)){throw new FS.ErrnoError(63)}MEMFS.ops_table||={dir:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,lookup:MEMFS.node_ops.lookup,mknod:MEMFS.node_ops.mknod,rename:MEMFS.node_ops.rename,unlink:MEMFS.node_ops.unlink,rmdir:MEMFS.node_ops.rmdir,readdir:MEMFS.node_ops.readdir,symlink:MEMFS.node_ops.symlink},stream:{llseek:MEMFS.stream_ops.llseek}},file:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:{llseek:MEMFS.stream_ops.llseek,read:MEMFS.stream_ops.read,write:MEMFS.stream_ops.write,mmap:MEMFS.stream_ops.mmap,msync:MEMFS.stream_ops.msync}},link:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,readlink:MEMFS.node_ops.readlink},stream:{}},chrdev:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:FS.chrdev_stream_ops}};var node=FS.createNode(parent,name,mode,dev);if(FS.isDir(node.mode)){node.node_ops=MEMFS.ops_table.dir.node;node.stream_ops=MEMFS.ops_table.dir.stream;node.contents={}}else if(FS.isFile(node.mode)){node.node_ops=MEMFS.ops_table.file.node;node.stream_ops=MEMFS.ops_table.file.stream;node.usedBytes=0;node.contents=null}else if(FS.isLink(node.mode)){node.node_ops=MEMFS.ops_table.link.node;node.stream_ops=MEMFS.ops_table.link.stream}else if(FS.isChrdev(node.mode)){node.node_ops=MEMFS.ops_table.chrdev.node;node.stream_ops=MEMFS.ops_table.chrdev.stream}node.atime=node.mtime=node.ctime=Date.now();if(parent){parent.contents[name]=node;parent.atime=parent.mtime=parent.ctime=node.atime}return node},getFileDataAsTypedArray(node){if(!node.contents)return new Uint8Array(0);if(node.contents.subarray)return node.contents.subarray(0,node.usedBytes);return new Uint8Array(node.contents)},expandFileStorage(node,newCapacity){var prevCapacity=node.contents?node.contents.length:0;if(prevCapacity>=newCapacity)return;var CAPACITY_DOUBLING_MAX=1024*1024;newCapacity=Math.max(newCapacity,prevCapacity*(prevCapacity<CAPACITY_DOUBLING_MAX?2:1.125)>>>0);if(prevCapacity!=0)newCapacity=Math.max(newCapacity,256);var oldContents=node.contents;node.contents=new Uint8Array(newCapacity);if(node.usedBytes>0)node.contents.set(oldContents.subarray(0,node.usedBytes),0)},resizeFileStorage(node,newSize){if(node.usedBytes==newSize)return;if(newSize==0){node.contents=null;node.usedBytes=0}else{var oldContents=node.contents;node.contents=new Uint8Array(newSize);if(oldContents){node.contents.set(oldContents.subarray(0,Math.min(newSize,node.usedBytes)))}node.usedBytes=newSize}},node_ops:{getattr(node){var attr={};attr.dev=FS.isChrdev(node.mode)?node.id:1;attr.ino=node.id;attr.mode=node.mode;attr.nlink=1;attr.uid=0;attr.gid=0;attr.rdev=node.rdev;if(FS.isDir(node.mode)){attr.size=4096}else if(FS.isFile(node.mode)){attr.size=node.usedBytes}else if(FS.isLink(node.mode)){attr.size=node.link.length}else{attr.size=0}attr.atime=new Date(node.atime);attr.mtime=new Date(node.mtime);attr.ctime=new Date(node.ctime);attr.blksize=4096;attr.blocks=Math.ceil(attr.size/attr.blksize);return attr},setattr(node,attr){for(const key of["mode","atime","mtime","ctime"]){if(attr[key]!=null){node[key]=attr[key]}}if(attr.size!==undefined){MEMFS.resizeFileStorage(node,attr.size)}},lookup(parent,name){if(!MEMFS.doesNotExistError){MEMFS.doesNotExistError=new FS.ErrnoError(44);MEMFS.doesNotExistError.stack="<generic error, no stack>"}throw MEMFS.doesNotExistError},mknod(parent,name,mode,dev){return MEMFS.createNode(parent,name,mode,dev)},rename(old_node,new_dir,new_name){var new_node;try{new_node=FS.lookupNode(new_dir,new_name)}catch(e){}if(new_node){if(FS.isDir(old_node.mode)){for(var i in new_node.contents){throw new FS.ErrnoError(55)}}FS.hashRemoveNode(new_node)}delete old_node.parent.contents[old_node.name];new_dir.contents[new_name]=old_node;old_node.name=new_name;new_dir.ctime=new_dir.mtime=old_node.parent.ctime=old_node.parent.mtime=Date.now()},unlink(parent,name){delete parent.contents[name];parent.ctime=parent.mtime=Date.now()},rmdir(parent,name){var node=FS.lookupNode(parent,name);for(var i in node.contents){throw new FS.ErrnoError(55)}delete parent.contents[name];parent.ctime=parent.mtime=Date.now()},readdir(node){return[".","..",...Object.keys(node.contents)]},symlink(parent,newname,oldpath){var node=MEMFS.createNode(parent,newname,511|40960,0);node.link=oldpath;return node},readlink(node){if(!FS.isLink(node.mode)){throw new FS.ErrnoError(28)}return node.link}},stream_ops:{read(stream,buffer,offset,length,position){var contents=stream.node.contents;if(position>=stream.node.usedBytes)return 0;var size=Math.min(stream.node.usedBytes-position,length);if(size>8&&contents.subarray){buffer.set(contents.subarray(position,position+size),offset)}else{for(var i=0;i<size;i++)buffer[offset+i]=contents[position+i]}return size},write(stream,buffer,offset,length,position,canOwn){if(buffer.buffer===HEAP8.buffer){canOwn=false}if(!length)return 0;var node=stream.node;node.mtime=node.ctime=Date.now();if(buffer.subarray&&(!node.contents||node.contents.subarray)){if(canOwn){node.contents=buffer.subarray(offset,offset+length);node.usedBytes=length;return length}else if(node.usedBytes===0&&position===0){node.contents=buffer.slice(offset,offset+length);node.usedBytes=length;return length}else if(position+length<=node.usedBytes){node.contents.set(buffer.subarray(offset,offset+length),position);return length}}MEMFS.expandFileStorage(node,position+length);if(node.contents.subarray&&buffer.subarray){node.contents.set(buffer.subarray(offset,offset+length),position)}else{for(var i=0;i<length;i++){node.contents[position+i]=buffer[offset+i]}}node.usedBytes=Math.max(node.usedBytes,position+length);return length},llseek(stream,offset,whence){var position=offset;if(whence===1){position+=stream.position}else if(whence===2){if(FS.isFile(stream.node.mode)){position+=stream.node.usedBytes}}if(position<0){throw new FS.ErrnoError(28)}return position},mmap(stream,length,position,prot,flags){if(!FS.isFile(stream.node.mode)){throw new FS.ErrnoError(43)}var ptr;var allocated;var contents=stream.node.contents;if(!(flags&2)&&contents&&contents.buffer===HEAP8.buffer){allocated=false;ptr=contents.byteOffset}else{allocated=true;ptr=mmapAlloc(length);if(!ptr){throw new FS.ErrnoError(48)}if(contents){if(position>0||position+length<contents.length){if(contents.subarray){contents=contents.subarray(position,position+length)}else{contents=Array.prototype.slice.call(contents,position,position+length)}}HEAP8.set(contents,ptr)}}return{ptr,allocated}},msync(stream,buffer,offset,length,mmapFlags){MEMFS.stream_ops.write(stream,buffer,0,length,offset,false);return 0}}};var FS_modeStringToFlags=str=>{var flagModes={r:0,"r+":2,w:512|64|1,"w+":512|64|2,a:1024|64|1,"a+":1024|64|2};var flags=flagModes[str];if(typeof flags=="undefined"){throw new Error(`Unknown file open mode: ${str}`)}return flags};var FS_getMode=(canRead,canWrite)=>{var mode=0;if(canRead)mode|=292|73;if(canWrite)mode|=146;return mode};var asyncLoad=async url=>{var arrayBuffer=await readAsync(url);return new Uint8Array(arrayBuffer)};var FS_createDataFile=(...args)=>FS.createDataFile(...args);var getUniqueRunDependency=id=>id;var preloadPlugins=[];var FS_handledByPreloadPlugin=async(byteArray,fullname)=>{if(typeof Browser!="undefined")Browser.init();for(var plugin of preloadPlugins){if(plugin["canHandle"](fullname)){return plugin["handle"](byteArray,fullname)}}return byteArray};var FS_preloadFile=async(parent,name,url,canRead,canWrite,dontCreateFile,canOwn,preFinish)=>{var fullname=name?PATH_FS.resolve(PATH.join2(parent,name)):parent;var dep=getUniqueRunDependency(`cp ${fullname}`);addRunDependency(dep);try{var byteArray=url;if(typeof url=="string"){byteArray=await asyncLoad(url)}byteArray=await FS_handledByPreloadPlugin(byteArray,fullname);preFinish?.();if(!dontCreateFile){FS_createDataFile(parent,name,byteArray,canRead,canWrite,canOwn)}}finally{removeRunDependency(dep)}};var FS_createPreloadedFile=(parent,name,url,canRead,canWrite,onload,onerror,dontCreateFile,canOwn,preFinish)=>{FS_preloadFile(parent,name,url,canRead,canWrite,dontCreateFile,canOwn,preFinish).then(onload).catch(onerror)};var FS={root:null,mounts:[],devices:{},streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,filesystems:null,syncFSRequests:0,readFiles:{},ErrnoError:class{name="ErrnoError";constructor(errno){this.errno=errno}},FSStream:class{shared={};get object(){return this.node}set object(val){this.node=val}get isRead(){return(this.flags&2097155)!==1}get isWrite(){return(this.flags&2097155)!==0}get isAppend(){return this.flags&1024}get flags(){return this.shared.flags}set flags(val){this.shared.flags=val}get position(){return this.shared.position}set position(val){this.shared.position=val}},FSNode:class{node_ops={};stream_ops={};readMode=292|73;writeMode=146;mounted=null;constructor(parent,name,mode,rdev){if(!parent){parent=this}this.parent=parent;this.mount=parent.mount;this.id=FS.nextInode++;this.name=name;this.mode=mode;this.rdev=rdev;this.atime=this.mtime=this.ctime=Date.now()}get read(){return(this.mode&this.readMode)===this.readMode}set read(val){val?this.mode|=this.readMode:this.mode&=~this.readMode}get write(){return(this.mode&this.writeMode)===this.writeMode}set write(val){val?this.mode|=this.writeMode:this.mode&=~this.writeMode}get isFolder(){return FS.isDir(this.mode)}get isDevice(){return FS.isChrdev(this.mode)}},lookupPath(path,opts={}){if(!path){throw new FS.ErrnoError(44)}opts.follow_mount??=true;if(!PATH.isAbs(path)){path=FS.cwd()+"/"+path}linkloop:for(var nlinks=0;nlinks<40;nlinks++){var parts=path.split("/").filter(p=>!!p);var current=FS.root;var current_path="/";for(var i=0;i<parts.length;i++){var islast=i===parts.length-1;if(islast&&opts.parent){break}if(parts[i]==="."){continue}if(parts[i]===".."){current_path=PATH.dirname(current_path);if(FS.isRoot(current)){path=current_path+"/"+parts.slice(i+1).join("/");nlinks--;continue linkloop}else{current=current.parent}continue}current_path=PATH.join2(current_path,parts[i]);try{current=FS.lookupNode(current,parts[i])}catch(e){if(e?.errno===44&&islast&&opts.noent_okay){return{path:current_path}}throw e}if(FS.isMountpoint(current)&&(!islast||opts.follow_mount)){current=current.mounted.root}if(FS.isLink(current.mode)&&(!islast||opts.follow)){if(!current.node_ops.readlink){throw new FS.ErrnoError(52)}var link=current.node_ops.readlink(current);if(!PATH.isAbs(link)){link=PATH.dirname(current_path)+"/"+link}path=link+"/"+parts.slice(i+1).join("/");continue linkloop}}return{path:current_path,node:current}}throw new FS.ErrnoError(32)},getPath(node){var path;while(true){if(FS.isRoot(node)){var mount=node.mount.mountpoint;if(!path)return mount;return mount[mount.length-1]!=="/"?`${mount}/${path}`:mount+path}path=path?`${node.name}/${path}`:node.name;node=node.parent}},hashName(parentid,name){var hash=0;for(var i=0;i<name.length;i++){hash=(hash<<5)-hash+name.charCodeAt(i)|0}return(parentid+hash>>>0)%FS.nameTable.length},hashAddNode(node){var hash=FS.hashName(node.parent.id,node.name);node.name_next=FS.nameTable[hash];FS.nameTable[hash]=node},hashRemoveNode(node){var hash=FS.hashName(node.parent.id,node.name);if(FS.nameTable[hash]===node){FS.nameTable[hash]=node.name_next}else{var current=FS.nameTable[hash];while(current){if(current.name_next===node){current.name_next=node.name_next;break}current=current.name_next}}},lookupNode(parent,name){var errCode=FS.mayLookup(parent);if(errCode){throw new FS.ErrnoError(errCode)}var hash=FS.hashName(parent.id,name);for(var node=FS.nameTable[hash];node;node=node.name_next){var nodeName=node.name;if(node.parent.id===parent.id&&nodeName===name){return node}}return FS.lookup(parent,name)},createNode(parent,name,mode,rdev){var node=new FS.FSNode(parent,name,mode,rdev);FS.hashAddNode(node);return node},destroyNode(node){FS.hashRemoveNode(node)},isRoot(node){return node===node.parent},isMountpoint(node){return!!node.mounted},isFile(mode){return(mode&61440)===32768},isDir(mode){return(mode&61440)===16384},isLink(mode){return(mode&61440)===40960},isChrdev(mode){return(mode&61440)===8192},isBlkdev(mode){return(mode&61440)===24576},isFIFO(mode){return(mode&61440)===4096},isSocket(mode){return(mode&49152)===49152},flagsToPermissionString(flag){var perms=["r","w","rw"][flag&3];if(flag&512){perms+="w"}return perms},nodePermissions(node,perms){if(FS.ignorePermissions){return 0}if(perms.includes("r")&&!(node.mode&292)){return 2}else if(perms.includes("w")&&!(node.mode&146)){return 2}else if(perms.includes("x")&&!(node.mode&73)){return 2}return 0},mayLookup(dir){if(!FS.isDir(dir.mode))return 54;var errCode=FS.nodePermissions(dir,"x");if(errCode)return errCode;if(!dir.node_ops.lookup)return 2;return 0},mayCreate(dir,name){if(!FS.isDir(dir.mode)){return 54}try{var node=FS.lookupNode(dir,name);return 20}catch(e){}return FS.nodePermissions(dir,"wx")},mayDelete(dir,name,isdir){var node;try{node=FS.lookupNode(dir,name)}catch(e){return e.errno}var errCode=FS.nodePermissions(dir,"wx");if(errCode){return errCode}if(isdir){if(!FS.isDir(node.mode)){return 54}if(FS.isRoot(node)||FS.getPath(node)===FS.cwd()){return 10}}else{if(FS.isDir(node.mode)){return 31}}return 0},mayOpen(node,flags){if(!node){return 44}if(FS.isLink(node.mode)){return 32}else if(FS.isDir(node.mode)){if(FS.flagsToPermissionString(flags)!=="r"||flags&(512|64)){return 31}}return FS.nodePermissions(node,FS.flagsToPermissionString(flags))},checkOpExists(op,err){if(!op){throw new FS.ErrnoError(err)}return op},MAX_OPEN_FDS:4096,nextfd(){for(var fd=0;fd<=FS.MAX_OPEN_FDS;fd++){if(!FS.streams[fd]){return fd}}throw new FS.ErrnoError(33)},getStreamChecked(fd){var stream=FS.getStream(fd);if(!stream){throw new FS.ErrnoError(8)}return stream},getStream:fd=>FS.streams[fd],createStream(stream,fd=-1){stream=Object.assign(new FS.FSStream,stream);if(fd==-1){fd=FS.nextfd()}stream.fd=fd;FS.streams[fd]=stream;return stream},closeStream(fd){FS.streams[fd]=null},dupStream(origStream,fd=-1){var stream=FS.createStream(origStream,fd);stream.stream_ops?.dup?.(stream);return stream},doSetAttr(stream,node,attr){var setattr=stream?.stream_ops.setattr;var arg=setattr?stream:node;setattr??=node.node_ops.setattr;FS.checkOpExists(setattr,63);setattr(arg,attr)},chrdev_stream_ops:{open(stream){var device=FS.getDevice(stream.node.rdev);stream.stream_ops=device.stream_ops;stream.stream_ops.open?.(stream)},llseek(){throw new FS.ErrnoError(70)}},major:dev=>dev>>8,minor:dev=>dev&255,makedev:(ma,mi)=>ma<<8|mi,registerDevice(dev,ops){FS.devices[dev]={stream_ops:ops}},getDevice:dev=>FS.devices[dev],getMounts(mount){var mounts=[];var check=[mount];while(check.length){var m=check.pop();mounts.push(m);check.push(...m.mounts)}return mounts},syncfs(populate,callback){if(typeof populate=="function"){callback=populate;populate=false}FS.syncFSRequests++;if(FS.syncFSRequests>1){err(`warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`)}var mounts=FS.getMounts(FS.root.mount);var completed=0;function doCallback(errCode){FS.syncFSRequests--;return callback(errCode)}function done(errCode){if(errCode){if(!done.errored){done.errored=true;return doCallback(errCode)}return}if(++completed>=mounts.length){doCallback(null)}}for(var mount of mounts){if(mount.type.syncfs){mount.type.syncfs(mount,populate,done)}else{done(null)}}},mount(type,opts,mountpoint){var root=mountpoint==="/";var pseudo=!mountpoint;var node;if(root&&FS.root){throw new FS.ErrnoError(10)}else if(!root&&!pseudo){var lookup=FS.lookupPath(mountpoint,{follow_mount:false});mountpoint=lookup.path;node=lookup.node;if(FS.isMountpoint(node)){throw new FS.ErrnoError(10)}if(!FS.isDir(node.mode)){throw new FS.ErrnoError(54)}}var mount={type,opts,mountpoint,mounts:[]};var mountRoot=type.mount(mount);mountRoot.mount=mount;mount.root=mountRoot;if(root){FS.root=mountRoot}else if(node){node.mounted=mount;if(node.mount){node.mount.mounts.push(mount)}}return mountRoot},unmount(mountpoint){var lookup=FS.lookupPath(mountpoint,{follow_mount:false});if(!FS.isMountpoint(lookup.node)){throw new FS.ErrnoError(28)}var node=lookup.node;var mount=node.mounted;var mounts=FS.getMounts(mount);for(var[hash,current]of Object.entries(FS.nameTable)){while(current){var next=current.name_next;if(mounts.includes(current.mount)){FS.destroyNode(current)}current=next}}node.mounted=null;var idx=node.mount.mounts.indexOf(mount);node.mount.mounts.splice(idx,1)},lookup(parent,name){return parent.node_ops.lookup(parent,name)},mknod(path,mode,dev){var lookup=FS.lookupPath(path,{parent:true});var parent=lookup.node;var name=PATH.basename(path);if(!name){throw new FS.ErrnoError(28)}if(name==="."||name===".."){throw new FS.ErrnoError(20)}var errCode=FS.mayCreate(parent,name);if(errCode){throw new FS.ErrnoError(errCode)}if(!parent.node_ops.mknod){throw new FS.ErrnoError(63)}return parent.node_ops.mknod(parent,name,mode,dev)},statfs(path){return FS.statfsNode(FS.lookupPath(path,{follow:true}).node)},statfsStream(stream){return FS.statfsNode(stream.node)},statfsNode(node){var rtn={bsize:4096,frsize:4096,blocks:1e6,bfree:5e5,bavail:5e5,files:FS.nextInode,ffree:FS.nextInode-1,fsid:42,flags:2,namelen:255};if(node.node_ops.statfs){Object.assign(rtn,node.node_ops.statfs(node.mount.opts.root))}return rtn},create(path,mode=438){mode&=4095;mode|=32768;return FS.mknod(path,mode,0)},mkdir(path,mode=511){mode&=511|512;mode|=16384;return FS.mknod(path,mode,0)},mkdirTree(path,mode){var dirs=path.split("/");var d="";for(var dir of dirs){if(!dir)continue;if(d||PATH.isAbs(path))d+="/";d+=dir;try{FS.mkdir(d,mode)}catch(e){if(e.errno!=20)throw e}}},mkdev(path,mode,dev){if(typeof dev=="undefined"){dev=mode;mode=438}mode|=8192;return FS.mknod(path,mode,dev)},symlink(oldpath,newpath){if(!PATH_FS.resolve(oldpath)){throw new FS.ErrnoError(44)}var lookup=FS.lookupPath(newpath,{parent:true});var parent=lookup.node;if(!parent){throw new FS.ErrnoError(44)}var newname=PATH.basename(newpath);var errCode=FS.mayCreate(parent,newname);if(errCode){throw new FS.ErrnoError(errCode)}if(!parent.node_ops.symlink){throw new FS.ErrnoError(63)}return parent.node_ops.symlink(parent,newname,oldpath)},rename(old_path,new_path){var old_dirname=PATH.dirname(old_path);var new_dirname=PATH.dirname(new_path);var old_name=PATH.basename(old_path);var new_name=PATH.basename(new_path);var lookup,old_dir,new_dir;lookup=FS.lookupPath(old_path,{parent:true});old_dir=lookup.node;lookup=FS.lookupPath(new_path,{parent:true});new_dir=lookup.node;if(!old_dir||!new_dir)throw new FS.ErrnoError(44);if(old_dir.mount!==new_dir.mount){throw new FS.ErrnoError(75)}var old_node=FS.lookupNode(old_dir,old_name);var relative=PATH_FS.relative(old_path,new_dirname);if(relative.charAt(0)!=="."){throw new FS.ErrnoError(28)}relative=PATH_FS.relative(new_path,old_dirname);if(relative.charAt(0)!=="."){throw new FS.ErrnoError(55)}var new_node;try{new_node=FS.lookupNode(new_dir,new_name)}catch(e){}if(old_node===new_node){return}var isdir=FS.isDir(old_node.mode);var errCode=FS.mayDelete(old_dir,old_name,isdir);if(errCode){throw new FS.ErrnoError(errCode)}errCode=new_node?FS.mayDelete(new_dir,new_name,isdir):FS.mayCreate(new_dir,new_name);if(errCode){throw new FS.ErrnoError(errCode)}if(!old_dir.node_ops.rename){throw new FS.ErrnoError(63)}if(FS.isMountpoint(old_node)||new_node&&FS.isMountpoint(new_node)){throw new FS.ErrnoError(10)}if(new_dir!==old_dir){errCode=FS.nodePermissions(old_dir,"w");if(errCode){throw new FS.ErrnoError(errCode)}}FS.hashRemoveNode(old_node);try{old_dir.node_ops.rename(old_node,new_dir,new_name);old_node.parent=new_dir}catch(e){throw e}finally{FS.hashAddNode(old_node)}},rmdir(path){var lookup=FS.lookupPath(path,{parent:true});var parent=lookup.node;var name=PATH.basename(path);var node=FS.lookupNode(parent,name);var errCode=FS.mayDelete(parent,name,true);if(errCode){throw new FS.ErrnoError(errCode)}if(!parent.node_ops.rmdir){throw new FS.ErrnoError(63)}if(FS.isMountpoint(node)){throw new FS.ErrnoError(10)}parent.node_ops.rmdir(parent,name);FS.destroyNode(node)},readdir(path){var lookup=FS.lookupPath(path,{follow:true});var node=lookup.node;var readdir=FS.checkOpExists(node.node_ops.readdir,54);return readdir(node)},unlink(path){var lookup=FS.lookupPath(path,{parent:true});var parent=lookup.node;if(!parent){throw new FS.ErrnoError(44)}var name=PATH.basename(path);var node=FS.lookupNode(parent,name);var errCode=FS.mayDelete(parent,name,false);if(errCode){throw new FS.ErrnoError(errCode)}if(!parent.node_ops.unlink){throw new FS.ErrnoError(63)}if(FS.isMountpoint(node)){throw new FS.ErrnoError(10)}parent.node_ops.unlink(parent,name);FS.destroyNode(node)},readlink(path){var lookup=FS.lookupPath(path);var link=lookup.node;if(!link){throw new FS.ErrnoError(44)}if(!link.node_ops.readlink){throw new FS.ErrnoError(28)}return link.node_ops.readlink(link)},stat(path,dontFollow){var lookup=FS.lookupPath(path,{follow:!dontFollow});var node=lookup.node;var getattr=FS.checkOpExists(node.node_ops.getattr,63);return getattr(node)},fstat(fd){var stream=FS.getStreamChecked(fd);var node=stream.node;var getattr=stream.stream_ops.getattr;var arg=getattr?stream:node;getattr??=node.node_ops.getattr;FS.checkOpExists(getattr,63);return getattr(arg)},lstat(path){return FS.stat(path,true)},doChmod(stream,node,mode,dontFollow){FS.doSetAttr(stream,node,{mode:mode&4095|node.mode&~4095,ctime:Date.now(),dontFollow})},chmod(path,mode,dontFollow){var node;if(typeof path=="string"){var lookup=FS.lookupPath(path,{follow:!dontFollow});node=lookup.node}else{node=path}FS.doChmod(null,node,mode,dontFollow)},lchmod(path,mode){FS.chmod(path,mode,true)},fchmod(fd,mode){var stream=FS.getStreamChecked(fd);FS.doChmod(stream,stream.node,mode,false)},doChown(stream,node,dontFollow){FS.doSetAttr(stream,node,{timestamp:Date.now(),dontFollow})},chown(path,uid,gid,dontFollow){var node;if(typeof path=="string"){var lookup=FS.lookupPath(path,{follow:!dontFollow});node=lookup.node}else{node=path}FS.doChown(null,node,dontFollow)},lchown(path,uid,gid){FS.chown(path,uid,gid,true)},fchown(fd,uid,gid){var stream=FS.getStreamChecked(fd);FS.doChown(stream,stream.node,false)},doTruncate(stream,node,len){if(FS.isDir(node.mode)){throw new FS.ErrnoError(31)}if(!FS.isFile(node.mode)){throw new FS.ErrnoError(28)}var errCode=FS.nodePermissions(node,"w");if(errCode){throw new FS.ErrnoError(errCode)}FS.doSetAttr(stream,node,{size:len,timestamp:Date.now()})},truncate(path,len){if(len<0){throw new FS.ErrnoError(28)}var node;if(typeof path=="string"){var lookup=FS.lookupPath(path,{follow:true});node=lookup.node}else{node=path}FS.doTruncate(null,node,len)},ftruncate(fd,len){var stream=FS.getStreamChecked(fd);if(len<0||(stream.flags&2097155)===0){throw new FS.ErrnoError(28)}FS.doTruncate(stream,stream.node,len)},utime(path,atime,mtime){var lookup=FS.lookupPath(path,{follow:true});var node=lookup.node;var setattr=FS.checkOpExists(node.node_ops.setattr,63);setattr(node,{atime,mtime})},open(path,flags,mode=438){if(path===""){throw new FS.ErrnoError(44)}flags=typeof flags=="string"?FS_modeStringToFlags(flags):flags;if(flags&64){mode=mode&4095|32768}else{mode=0}var node;var isDirPath;if(typeof path=="object"){node=path}else{isDirPath=path.endsWith("/");var lookup=FS.lookupPath(path,{follow:!(flags&131072),noent_okay:true});node=lookup.node;path=lookup.path}var created=false;if(flags&64){if(node){if(flags&128){throw new FS.ErrnoError(20)}}else if(isDirPath){throw new FS.ErrnoError(31)}else{node=FS.mknod(path,mode|511,0);created=true}}if(!node){throw new FS.ErrnoError(44)}if(FS.isChrdev(node.mode)){flags&=~512}if(flags&65536&&!FS.isDir(node.mode)){throw new FS.ErrnoError(54)}if(!created){var errCode=FS.mayOpen(node,flags);if(errCode){throw new FS.ErrnoError(errCode)}}if(flags&512&&!created){FS.truncate(node,0)}flags&=~(128|512|131072);var stream=FS.createStream({node,path:FS.getPath(node),flags,seekable:true,position:0,stream_ops:node.stream_ops,ungotten:[],error:false});if(stream.stream_ops.open){stream.stream_ops.open(stream)}if(created){FS.chmod(node,mode&511)}if(Module["logReadFiles"]&&!(flags&1)){if(!(path in FS.readFiles)){FS.readFiles[path]=1}}return stream},close(stream){if(FS.isClosed(stream)){throw new FS.ErrnoError(8)}if(stream.getdents)stream.getdents=null;try{if(stream.stream_ops.close){stream.stream_ops.close(stream)}}catch(e){throw e}finally{FS.closeStream(stream.fd)}stream.fd=null},isClosed(stream){return stream.fd===null},llseek(stream,offset,whence){if(FS.isClosed(stream)){throw new FS.ErrnoError(8)}if(!stream.seekable||!stream.stream_ops.llseek){throw new FS.ErrnoError(70)}if(whence!=0&&whence!=1&&whence!=2){throw new FS.ErrnoError(28)}stream.position=stream.stream_ops.llseek(stream,offset,whence);stream.ungotten=[];return stream.position},read(stream,buffer,offset,length,position){if(length<0||position<0){throw new FS.ErrnoError(28)}if(FS.isClosed(stream)){throw new FS.ErrnoError(8)}if((stream.flags&2097155)===1){throw new FS.ErrnoError(8)}if(FS.isDir(stream.node.mode)){throw new FS.ErrnoError(31)}if(!stream.stream_ops.read){throw new FS.ErrnoError(28)}var seeking=typeof position!="undefined";if(!seeking){position=stream.position}else if(!stream.seekable){throw new FS.ErrnoError(70)}var bytesRead=stream.stream_ops.read(stream,buffer,offset,length,position);if(!seeking)stream.position+=bytesRead;return bytesRead},write(stream,buffer,offset,length,position,canOwn){if(length<0||position<0){throw new FS.ErrnoError(28)}if(FS.isClosed(stream)){throw new FS.ErrnoError(8)}if((stream.flags&2097155)===0){throw new FS.ErrnoError(8)}if(FS.isDir(stream.node.mode)){throw new FS.ErrnoError(31)}if(!stream.stream_ops.write){throw new FS.ErrnoError(28)}if(stream.seekable&&stream.flags&1024){FS.llseek(stream,0,2)}var seeking=typeof position!="undefined";if(!seeking){position=stream.position}else if(!stream.seekable){throw new FS.ErrnoError(70)}var bytesWritten=stream.stream_ops.write(stream,buffer,offset,length,position,canOwn);if(!seeking)stream.position+=bytesWritten;return bytesWritten},mmap(stream,length,position,prot,flags){if((prot&2)!==0&&(flags&2)===0&&(stream.flags&2097155)!==2){throw new FS.ErrnoError(2)}if((stream.flags&2097155)===1){throw new FS.ErrnoError(2)}if(!stream.stream_ops.mmap){throw new FS.ErrnoError(43)}if(!length){throw new FS.ErrnoError(28)}return stream.stream_ops.mmap(stream,length,position,prot,flags)},msync(stream,buffer,offset,length,mmapFlags){if(!stream.stream_ops.msync){return 0}return stream.stream_ops.msync(stream,buffer,offset,length,mmapFlags)},ioctl(stream,cmd,arg){if(!stream.stream_ops.ioctl){throw new FS.ErrnoError(59)}return stream.stream_ops.ioctl(stream,cmd,arg)},readFile(path,opts={}){opts.flags=opts.flags||0;opts.encoding=opts.encoding||"binary";if(opts.encoding!=="utf8"&&opts.encoding!=="binary"){abort(`Invalid encoding type "${opts.encoding}"`)}var stream=FS.open(path,opts.flags);var stat=FS.stat(path);var length=stat.size;var buf=new Uint8Array(length);FS.read(stream,buf,0,length,0);if(opts.encoding==="utf8"){buf=UTF8ArrayToString(buf)}FS.close(stream);return buf},writeFile(path,data,opts={}){opts.flags=opts.flags||577;var stream=FS.open(path,opts.flags,opts.mode);if(typeof data=="string"){data=new Uint8Array(intArrayFromString(data,true))}if(ArrayBuffer.isView(data)){FS.write(stream,data,0,data.byteLength,undefined,opts.canOwn)}else{abort("Unsupported data type")}FS.close(stream)},cwd:()=>FS.currentPath,chdir(path){var lookup=FS.lookupPath(path,{follow:true});if(lookup.node===null){throw new FS.ErrnoError(44)}if(!FS.isDir(lookup.node.mode)){throw new FS.ErrnoError(54)}var errCode=FS.nodePermissions(lookup.node,"x");if(errCode){throw new FS.ErrnoError(errCode)}FS.currentPath=lookup.path},createDefaultDirectories(){FS.mkdir("/tmp");FS.mkdir("/home");FS.mkdir("/home/web_user")},createDefaultDevices(){FS.mkdir("/dev");FS.registerDevice(FS.makedev(1,3),{read:()=>0,write:(stream,buffer,offset,length,pos)=>length,llseek:()=>0});FS.mkdev("/dev/null",FS.makedev(1,3));TTY.register(FS.makedev(5,0),TTY.default_tty_ops);TTY.register(FS.makedev(6,0),TTY.default_tty1_ops);FS.mkdev("/dev/tty",FS.makedev(5,0));FS.mkdev("/dev/tty1",FS.makedev(6,0));var randomBuffer=new Uint8Array(1024),randomLeft=0;var randomByte=()=>{if(randomLeft===0){randomFill(randomBuffer);randomLeft=randomBuffer.byteLength}return randomBuffer[--randomLeft]};FS.createDevice("/dev","random",randomByte);FS.createDevice("/dev","urandom",randomByte);FS.mkdir("/dev/shm");FS.mkdir("/dev/shm/tmp")},createSpecialDirectories(){FS.mkdir("/proc");var proc_self=FS.mkdir("/proc/self");FS.mkdir("/proc/self/fd");FS.mount({mount(){var node=FS.createNode(proc_self,"fd",16895,73);node.stream_ops={llseek:MEMFS.stream_ops.llseek};node.node_ops={lookup(parent,name){var fd=+name;var stream=FS.getStreamChecked(fd);var ret={parent:null,mount:{mountpoint:"fake"},node_ops:{readlink:()=>stream.path},id:fd+1};ret.parent=ret;return ret},readdir(){return Array.from(FS.streams.entries()).filter(([k,v])=>v).map(([k,v])=>k.toString())}};return node}},{},"/proc/self/fd")},createStandardStreams(input,output,error){if(input){FS.createDevice("/dev","stdin",input)}else{FS.symlink("/dev/tty","/dev/stdin")}if(output){FS.createDevice("/dev","stdout",null,output)}else{FS.symlink("/dev/tty","/dev/stdout")}if(error){FS.createDevice("/dev","stderr",null,error)}else{FS.symlink("/dev/tty1","/dev/stderr")}var stdin=FS.open("/dev/stdin",0);var stdout=FS.open("/dev/stdout",1);var stderr=FS.open("/dev/stderr",1)},staticInit(){FS.nameTable=new Array(4096);FS.mount(MEMFS,{},"/");FS.createDefaultDirectories();FS.createDefaultDevices();FS.createSpecialDirectories();FS.filesystems={MEMFS}},init(input,output,error){FS.initialized=true;input??=Module["stdin"];output??=Module["stdout"];error??=Module["stderr"];FS.createStandardStreams(input,output,error)},quit(){FS.initialized=false;for(var stream of FS.streams){if(stream){FS.close(stream)}}},findObject(path,dontResolveLastLink){var ret=FS.analyzePath(path,dontResolveLastLink);if(!ret.exists){return null}return ret.object},analyzePath(path,dontResolveLastLink){try{var lookup=FS.lookupPath(path,{follow:!dontResolveLastLink});path=lookup.path}catch(e){}var ret={isRoot:false,exists:false,error:0,name:null,path:null,object:null,parentExists:false,parentPath:null,parentObject:null};try{var lookup=FS.lookupPath(path,{parent:true});ret.parentExists=true;ret.parentPath=lookup.path;ret.parentObject=lookup.node;ret.name=PATH.basename(path);lookup=FS.lookupPath(path,{follow:!dontResolveLastLink});ret.exists=true;ret.path=lookup.path;ret.object=lookup.node;ret.name=lookup.node.name;ret.isRoot=lookup.path==="/"}catch(e){ret.error=e.errno}return ret},createPath(parent,path,canRead,canWrite){parent=typeof parent=="string"?parent:FS.getPath(parent);var parts=path.split("/").reverse();while(parts.length){var part=parts.pop();if(!part)continue;var current=PATH.join2(parent,part);try{FS.mkdir(current)}catch(e){if(e.errno!=20)throw e}parent=current}return current},createFile(parent,name,properties,canRead,canWrite){var path=PATH.join2(typeof parent=="string"?parent:FS.getPath(parent),name);var mode=FS_getMode(canRead,canWrite);return FS.create(path,mode)},createDataFile(parent,name,data,canRead,canWrite,canOwn){var path=name;if(parent){parent=typeof parent=="string"?parent:FS.getPath(parent);path=name?PATH.join2(parent,name):parent}var mode=FS_getMode(canRead,canWrite);var node=FS.create(path,mode);if(data){if(typeof data=="string"){var arr=new Array(data.length);for(var i=0,len=data.length;i<len;++i)arr[i]=data.charCodeAt(i);data=arr}FS.chmod(node,mode|146);var stream=FS.open(node,577);FS.write(stream,data,0,data.length,0,canOwn);FS.close(stream);FS.chmod(node,mode)}},createDevice(parent,name,input,output){var path=PATH.join2(typeof parent=="string"?parent:FS.getPath(parent),name);var mode=FS_getMode(!!input,!!output);FS.createDevice.major??=64;var dev=FS.makedev(FS.createDevice.major++,0);FS.registerDevice(dev,{open(stream){stream.seekable=false},close(stream){if(output?.buffer?.length){output(10)}},read(stream,buffer,offset,length,pos){var bytesRead=0;for(var i=0;i<length;i++){var result;try{result=input()}catch(e){throw new FS.ErrnoError(29)}if(result===undefined&&bytesRead===0){throw new FS.ErrnoError(6)}if(result===null||result===undefined)break;bytesRead++;buffer[offset+i]=result}if(bytesRead){stream.node.atime=Date.now()}return bytesRead},write(stream,buffer,offset,length,pos){for(var i=0;i<length;i++){try{output(buffer[offset+i])}catch(e){throw new FS.ErrnoError(29)}}if(length){stream.node.mtime=stream.node.ctime=Date.now()}return i}});return FS.mkdev(path,mode,dev)},forceLoadFile(obj){if(obj.isDevice||obj.isFolder||obj.link||obj.contents)return true;if(globalThis.XMLHttpRequest){abort("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")}else{try{obj.contents=readBinary(obj.url)}catch(e){throw new FS.ErrnoError(29)}}},createLazyFile(parent,name,url,canRead,canWrite){class LazyUint8Array{lengthKnown=false;chunks=[];get(idx){if(idx>this.length-1||idx<0){return undefined}var chunkOffset=idx%this.chunkSize;var chunkNum=idx/this.chunkSize|0;return this.getter(chunkNum)[chunkOffset]}setDataGetter(getter){this.getter=getter}cacheLength(){var xhr=new XMLHttpRequest;xhr.open("HEAD",url,false);xhr.send(null);if(!(xhr.status>=200&&xhr.status<300||xhr.status===304))abort("Couldn't load "+url+". Status: "+xhr.status);var datalength=Number(xhr.getResponseHeader("Content-length"));var header;var hasByteServing=(header=xhr.getResponseHeader("Accept-Ranges"))&&header==="bytes";var usesGzip=(header=xhr.getResponseHeader("Content-Encoding"))&&header==="gzip";var chunkSize=1024*1024;if(!hasByteServing)chunkSize=datalength;var doXHR=(from,to)=>{if(from>to)abort("invalid range ("+from+", "+to+") or no bytes requested!");if(to>datalength-1)abort("only "+datalength+" bytes available! programmer error!");var xhr=new XMLHttpRequest;xhr.open("GET",url,false);if(datalength!==chunkSize)xhr.setRequestHeader("Range","bytes="+from+"-"+to);xhr.responseType="arraybuffer";if(xhr.overrideMimeType){xhr.overrideMimeType("text/plain; charset=x-user-defined")}xhr.send(null);if(!(xhr.status>=200&&xhr.status<300||xhr.status===304))abort("Couldn't load "+url+". Status: "+xhr.status);if(xhr.response!==undefined){return new Uint8Array(xhr.response||[])}return intArrayFromString(xhr.responseText||"",true)};var lazyArray=this;lazyArray.setDataGetter(chunkNum=>{var start=chunkNum*chunkSize;var end=(chunkNum+1)*chunkSize-1;end=Math.min(end,datalength-1);if(typeof lazyArray.chunks[chunkNum]=="undefined"){lazyArray.chunks[chunkNum]=doXHR(start,end)}if(typeof lazyArray.chunks[chunkNum]=="undefined")abort("doXHR failed!");return lazyArray.chunks[chunkNum]});if(usesGzip||!datalength){chunkSize=datalength=1;datalength=this.getter(0).length;chunkSize=datalength;out("LazyFiles on gzip forces download of the whole file when length is accessed")}this._length=datalength;this._chunkSize=chunkSize;this.lengthKnown=true}get length(){if(!this.lengthKnown){this.cacheLength()}return this._length}get chunkSize(){if(!this.lengthKnown){this.cacheLength()}return this._chunkSize}}if(globalThis.XMLHttpRequest){if(!ENVIRONMENT_IS_WORKER)abort("Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc");var lazyArray=new LazyUint8Array;var properties={isDevice:false,contents:lazyArray}}else{var properties={isDevice:false,url}}var node=FS.createFile(parent,name,properties,canRead,canWrite);if(properties.contents){node.contents=properties.contents}else if(properties.url){node.contents=null;node.url=properties.url}Object.defineProperties(node,{usedBytes:{get:function(){return this.contents.length}}});var stream_ops={};for(const[key,fn]of Object.entries(node.stream_ops)){stream_ops[key]=(...args)=>{FS.forceLoadFile(node);return fn(...args)}}function writeChunks(stream,buffer,offset,length,position){var contents=stream.node.contents;if(position>=contents.length)return 0;var size=Math.min(contents.length-position,length);if(contents.slice){for(var i=0;i<size;i++){buffer[offset+i]=contents[position+i]}}else{for(var i=0;i<size;i++){buffer[offset+i]=contents.get(position+i)}}return size}stream_ops.read=(stream,buffer,offset,length,position)=>{FS.forceLoadFile(node);return writeChunks(stream,buffer,offset,length,position)};stream_ops.mmap=(stream,length,position,prot,flags)=>{FS.forceLoadFile(node);var ptr=mmapAlloc(length);if(!ptr){throw new FS.ErrnoError(48)}writeChunks(stream,HEAP8,ptr,length,position);return{ptr,allocated:true}};node.stream_ops=stream_ops;return node}};var UTF8ToString=(ptr,maxBytesToRead,ignoreNul)=>ptr?UTF8ArrayToString(HEAPU8,ptr,maxBytesToRead,ignoreNul):"";var SYSCALLS={DEFAULT_POLLMASK:5,calculateAt(dirfd,path,allowEmpty){if(PATH.isAbs(path)){return path}var dir;if(dirfd===-100){dir=FS.cwd()}else{var dirstream=SYSCALLS.getStreamFromFD(dirfd);dir=dirstream.path}if(path.length==0){if(!allowEmpty){throw new FS.ErrnoError(44)}return dir}return dir+"/"+path},writeStat(buf,stat){HEAPU32[buf>>2]=stat.dev;HEAPU32[buf+4>>2]=stat.mode;HEAPU32[buf+8>>2]=stat.nlink;HEAPU32[buf+12>>2]=stat.uid;HEAPU32[buf+16>>2]=stat.gid;HEAPU32[buf+20>>2]=stat.rdev;HEAP64[buf+24>>3]=BigInt(stat.size);HEAP32[buf+32>>2]=4096;HEAP32[buf+36>>2]=stat.blocks;var atime=stat.atime.getTime();var mtime=stat.mtime.getTime();var ctime=stat.ctime.getTime();HEAP64[buf+40>>3]=BigInt(Math.floor(atime/1e3));HEAPU32[buf+48>>2]=atime%1e3*1e3*1e3;HEAP64[buf+56>>3]=BigInt(Math.floor(mtime/1e3));HEAPU32[buf+64>>2]=mtime%1e3*1e3*1e3;HEAP64[buf+72>>3]=BigInt(Math.floor(ctime/1e3));HEAPU32[buf+80>>2]=ctime%1e3*1e3*1e3;HEAP64[buf+88>>3]=BigInt(stat.ino);return 0},writeStatFs(buf,stats){HEAPU32[buf+4>>2]=stats.bsize;HEAPU32[buf+60>>2]=stats.bsize;HEAP64[buf+8>>3]=BigInt(stats.blocks);HEAP64[buf+16>>3]=BigInt(stats.bfree);HEAP64[buf+24>>3]=BigInt(stats.bavail);HEAP64[buf+32>>3]=BigInt(stats.files);HEAP64[buf+40>>3]=BigInt(stats.ffree);HEAPU32[buf+48>>2]=stats.fsid;HEAPU32[buf+64>>2]=stats.flags;HEAPU32[buf+56>>2]=stats.namelen},doMsync(addr,stream,len,flags,offset){if(!FS.isFile(stream.node.mode)){throw new FS.ErrnoError(43)}if(flags&2){return 0}var buffer=HEAPU8.slice(addr,addr+len);FS.msync(stream,buffer,offset,len,flags)},getStreamFromFD(fd){var stream=FS.getStreamChecked(fd);return stream},varargs:undefined,getStr(ptr){var ret=UTF8ToString(ptr);return ret}};function ___syscall_fcntl64(fd,cmd,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.getStreamFromFD(fd);switch(cmd){case 0:{var arg=syscallGetVarargI();if(arg<0){return-28}while(FS.streams[arg]){arg++}var newStream;newStream=FS.dupStream(stream,arg);return newStream.fd}case 1:case 2:return 0;case 3:return stream.flags;case 4:{var arg=syscallGetVarargI();stream.flags|=arg;return 0}case 12:{var arg=syscallGetVarargP();var offset=0;HEAP16[arg+offset>>1]=2;return 0}case 13:case 14:return 0}return-28}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return-e.errno}}function ___syscall_ioctl(fd,op,varargs){SYSCALLS.varargs=varargs;try{var stream=SYSCALLS.getStreamFromFD(fd);switch(op){case 21509:{if(!stream.tty)return-59;return 0}case 21505:{if(!stream.tty)return-59;if(stream.tty.ops.ioctl_tcgets){var termios=stream.tty.ops.ioctl_tcgets(stream);var argp=syscallGetVarargP();HEAP32[argp>>2]=termios.c_iflag||0;HEAP32[argp+4>>2]=termios.c_oflag||0;HEAP32[argp+8>>2]=termios.c_cflag||0;HEAP32[argp+12>>2]=termios.c_lflag||0;for(var i=0;i<32;i++){HEAP8[argp+i+17]=termios.c_cc[i]||0}return 0}return 0}case 21510:case 21511:case 21512:{if(!stream.tty)return-59;return 0}case 21506:case 21507:case 21508:{if(!stream.tty)return-59;if(stream.tty.ops.ioctl_tcsets){var argp=syscallGetVarargP();var c_iflag=HEAP32[argp>>2];var c_oflag=HEAP32[argp+4>>2];var c_cflag=HEAP32[argp+8>>2];var c_lflag=HEAP32[argp+12>>2];var c_cc=[];for(var i=0;i<32;i++){c_cc.push(HEAP8[argp+i+17])}return stream.tty.ops.ioctl_tcsets(stream.tty,op,{c_iflag,c_oflag,c_cflag,c_lflag,c_cc})}return 0}case 21519:{if(!stream.tty)return-59;var argp=syscallGetVarargP();HEAP32[argp>>2]=0;return 0}case 21520:{if(!stream.tty)return-59;return-28}case 21537:case 21531:{var argp=syscallGetVarargP();return FS.ioctl(stream,op,argp)}case 21523:{if(!stream.tty)return-59;if(stream.tty.ops.ioctl_tiocgwinsz){var winsize=stream.tty.ops.ioctl_tiocgwinsz(stream.tty);var argp=syscallGetVarargP();HEAP16[argp>>1]=winsize[0];HEAP16[argp+2>>1]=winsize[1]}return 0}case 21524:{if(!stream.tty)return-59;return 0}case 21515:{if(!stream.tty)return-59;return 0}default:return-28}}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return-e.errno}}function ___syscall_openat(dirfd,path,flags,varargs){SYSCALLS.varargs=varargs;try{path=SYSCALLS.getStr(path);path=SYSCALLS.calculateAt(dirfd,path);var mode=varargs?syscallGetVarargI():0;return FS.open(path,flags,mode).fd}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return-e.errno}}var __abort_js=()=>abort("");var stringToUTF8=(str,outPtr,maxBytesToWrite)=>stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite);var __tzset_js=(timezone,daylight,std_name,dst_name)=>{var currentYear=(new Date).getFullYear();var winter=new Date(currentYear,0,1);var summer=new Date(currentYear,6,1);var winterOffset=winter.getTimezoneOffset();var summerOffset=summer.getTimezoneOffset();var stdTimezoneOffset=Math.max(winterOffset,summerOffset);HEAPU32[timezone>>2]=stdTimezoneOffset*60;HEAP32[daylight>>2]=Number(winterOffset!=summerOffset);var extractZone=timezoneOffset=>{var sign=timezoneOffset>=0?"-":"+";var absOffset=Math.abs(timezoneOffset);var hours=String(Math.floor(absOffset/60)).padStart(2,"0");var minutes=String(absOffset%60).padStart(2,"0");return`UTC${sign}${hours}${minutes}`};var winterName=extractZone(winterOffset);var summerName=extractZone(summerOffset);if(summerOffset<winterOffset){stringToUTF8(winterName,std_name,17);stringToUTF8(summerName,dst_name,17)}else{stringToUTF8(winterName,dst_name,17);stringToUTF8(summerName,std_name,17)}};var _emscripten_date_now=()=>Date.now();var getHeapMax=()=>2147483648;var _emscripten_get_heap_max=()=>getHeapMax();var alignMemory=(size,alignment)=>Math.ceil(size/alignment)*alignment;var growMemory=size=>{var oldHeapSize=wasmMemory.buffer.byteLength;var pages=(size-oldHeapSize+65535)/65536|0;try{wasmMemory.grow(pages);updateMemoryViews();return 1}catch(e){}};var _emscripten_resize_heap=requestedSize=>{var oldSize=HEAPU8.length;requestedSize>>>=0;var maxHeapSize=getHeapMax();if(requestedSize>maxHeapSize){return false}for(var cutDown=1;cutDown<=4;cutDown*=2){var overGrownHeapSize=oldSize*(1+.2/cutDown);overGrownHeapSize=Math.min(overGrownHeapSize,requestedSize+100663296);var newSize=Math.min(maxHeapSize,alignMemory(Math.max(requestedSize,overGrownHeapSize),65536));var replacement=growMemory(newSize);if(replacement){return true}}return false};var ENV={};var getExecutableName=()=>thisProgram||"./this.program";var getEnvStrings=()=>{if(!getEnvStrings.strings){var lang=(globalThis.navigator?.language??"C").replace("-","_")+".UTF-8";var env={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:lang,_:getExecutableName()};for(var x in ENV){if(ENV[x]===undefined)delete env[x];else env[x]=ENV[x]}var strings=[];for(var x in env){strings.push(`${x}=${env[x]}`)}getEnvStrings.strings=strings}return getEnvStrings.strings};var _environ_get=(__environ,environ_buf)=>{var bufSize=0;var envp=0;for(var string of getEnvStrings()){var ptr=environ_buf+bufSize;HEAPU32[__environ+envp>>2]=ptr;bufSize+=stringToUTF8(string,ptr,Infinity)+1;envp+=4}return 0};var _environ_sizes_get=(penviron_count,penviron_buf_size)=>{var strings=getEnvStrings();HEAPU32[penviron_count>>2]=strings.length;var bufSize=0;for(var string of strings){bufSize+=lengthBytesUTF8(string)+1}HEAPU32[penviron_buf_size>>2]=bufSize;return 0};function _fd_close(fd){try{var stream=SYSCALLS.getStreamFromFD(fd);FS.close(stream);return 0}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return e.errno}}var doReadv=(stream,iov,iovcnt,offset)=>{var ret=0;for(var i=0;i<iovcnt;i++){var ptr=HEAPU32[iov>>2];var len=HEAPU32[iov+4>>2];iov+=8;var curr=FS.read(stream,HEAP8,ptr,len,offset);if(curr<0)return-1;ret+=curr;if(curr<len)break;if(typeof offset!="undefined"){offset+=curr}}return ret};function _fd_read(fd,iov,iovcnt,pnum){try{var stream=SYSCALLS.getStreamFromFD(fd);var num=doReadv(stream,iov,iovcnt);HEAPU32[pnum>>2]=num;return 0}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return e.errno}}var INT53_MAX=9007199254740992;var INT53_MIN=-9007199254740992;var bigintToI53Checked=num=>num<INT53_MIN||num>INT53_MAX?NaN:Number(num);function _fd_seek(fd,offset,whence,newOffset){offset=bigintToI53Checked(offset);try{if(isNaN(offset))return 61;var stream=SYSCALLS.getStreamFromFD(fd);FS.llseek(stream,offset,whence);HEAP64[newOffset>>3]=BigInt(stream.position);if(stream.getdents&&offset===0&&whence===0)stream.getdents=null;return 0}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return e.errno}}var doWritev=(stream,iov,iovcnt,offset)=>{var ret=0;for(var i=0;i<iovcnt;i++){var ptr=HEAPU32[iov>>2];var len=HEAPU32[iov+4>>2];iov+=8;var curr=FS.write(stream,HEAP8,ptr,len,offset);if(curr<0)return-1;ret+=curr;if(curr<len){break}if(typeof offset!="undefined"){offset+=curr}}return ret};function _fd_write(fd,iov,iovcnt,pnum){try{var stream=SYSCALLS.getStreamFromFD(fd);var num=doWritev(stream,iov,iovcnt);HEAPU32[pnum>>2]=num;return 0}catch(e){if(typeof FS=="undefined"||!(e.name==="ErrnoError"))throw e;return e.errno}}var runtimeKeepaliveCounter=0;var keepRuntimeAlive=()=>noExitRuntime||runtimeKeepaliveCounter>0;var _proc_exit=code=>{EXITSTATUS=code;if(!keepRuntimeAlive()){Module["onExit"]?.(code);ABORT=true}quit_(code,new ExitStatus(code))};var exitJS=(status,implicit)=>{EXITSTATUS=status;_proc_exit(status)};var handleException=e=>{if(e instanceof ExitStatus||e=="unwind"){return EXITSTATUS}quit_(1,e)};var stackAlloc=sz=>__emscripten_stack_alloc(sz);var stringToUTF8OnStack=str=>{var size=lengthBytesUTF8(str)+1;var ret=stackAlloc(size);stringToUTF8(str,ret,size);return ret};var wasmTableMirror=[];var getWasmTableEntry=funcPtr=>{var func=wasmTableMirror[funcPtr];if(!func){wasmTableMirror[funcPtr]=func=wasmTable.get(funcPtr)}return func};var getCFunc=ident=>{var func=Module["_"+ident];return func};var writeArrayToMemory=(array,buffer)=>{HEAP8.set(array,buffer)};var ccall=(ident,returnType,argTypes,args,opts)=>{var toC={string:str=>{var ret=0;if(str!==null&&str!==undefined&&str!==0){ret=stringToUTF8OnStack(str)}return ret},array:arr=>{var ret=stackAlloc(arr.length);writeArrayToMemory(arr,ret);return ret}};function convertReturnValue(ret){if(returnType==="string"){return UTF8ToString(ret)}if(returnType==="boolean")return Boolean(ret);return ret}var func=getCFunc(ident);var cArgs=[];var stack=0;if(args){for(var i=0;i<args.length;i++){var converter=toC[argTypes[i]];if(converter){if(stack===0)stack=stackSave();cArgs[i]=converter(args[i])}else{cArgs[i]=args[i]}}}var ret=func(...cArgs);function onDone(ret){if(stack!==0)stackRestore(stack);return convertReturnValue(ret)}ret=onDone(ret);return ret};FS.createPreloadedFile=FS_createPreloadedFile;FS.preloadFile=FS_preloadFile;FS.staticInit();{if(Module["noExitRuntime"])noExitRuntime=Module["noExitRuntime"];if(Module["preloadPlugins"])preloadPlugins=Module["preloadPlugins"];if(Module["print"])out=Module["print"];if(Module["printErr"])err=Module["printErr"];if(Module["wasmBinary"])wasmBinary=Module["wasmBinary"];if(Module["arguments"])arguments_=Module["arguments"];if(Module["thisProgram"])thisProgram=Module["thisProgram"];if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].shift()()}}}Module["callMain"]=callMain;Module["ccall"]=ccall;var _main,_setThrew,__emscripten_tempret_set,__emscripten_stack_restore,__emscripten_stack_alloc,_emscripten_stack_get_current,___cxa_decrement_exception_refcount,___cxa_increment_exception_refcount,___cxa_can_catch,___cxa_get_exception_ptr,memory,__indirect_function_table,wasmMemory,wasmTable;function assignWasmExports(wasmExports){_main=Module["_main"]=wasmExports["Y"];_setThrew=wasmExports["Z"];__emscripten_tempret_set=wasmExports["_"];__emscripten_stack_restore=wasmExports["$"];__emscripten_stack_alloc=wasmExports["aa"];_emscripten_stack_get_current=wasmExports["ba"];___cxa_decrement_exception_refcount=wasmExports["ca"];___cxa_increment_exception_refcount=wasmExports["da"];___cxa_can_catch=wasmExports["ea"];___cxa_get_exception_ptr=wasmExports["fa"];memory=wasmMemory=wasmExports["V"];__indirect_function_table=wasmTable=wasmExports["X"]}var wasmImports={j:___cxa_begin_catch,k:___cxa_end_catch,a:___cxa_find_matching_catch_2,f:___cxa_find_matching_catch_3,F:___cxa_rethrow,i:___cxa_throw,D:___cxa_uncaught_exceptions,c:___resumeException,C:___syscall_fcntl64,P:___syscall_ioctl,S:___syscall_openat,J:__abort_js,M:__tzset_js,U:_emscripten_date_now,G:_emscripten_get_heap_max,T:_emscripten_resize_heap,N:_environ_get,O:_environ_sizes_get,x:_fd_close,I:_fd_read,H:_fd_seek,y:_fd_write,z:invoke_diii,A:invoke_fiii,l:invoke_i,b:invoke_ii,e:invoke_iii,m:invoke_iiii,h:invoke_iiiii,Q:invoke_iiiiid,r:invoke_iiiiii,q:invoke_iiiiiii,B:invoke_iiiiiiii,u:invoke_iiiiiiiiiiii,R:invoke_iiiiij,v:invoke_jiiii,g:invoke_v,n:invoke_vi,d:invoke_vii,K:invoke_viid,L:invoke_viif,o:invoke_viii,w:invoke_viiii,p:invoke_viiiiiii,s:invoke_viiiiiiiiii,t:invoke_viiiiiiiiiiiiiii,E:invoke_viijii};function invoke_iii(index,a1,a2){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_ii(index,a1){var sp=stackSave();try{return getWasmTableEntry(index)(a1)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_vii(index,a1,a2){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_vi(index,a1){var sp=stackSave();try{getWasmTableEntry(index)(a1)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_v(index){var sp=stackSave();try{getWasmTableEntry(index)()}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiiiii(index,a1,a2,a3,a4,a5,a6){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiii(index,a1,a2,a3){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viijii(index,a1,a2,a3,a4,a5){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3,a4,a5)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viiii(index,a1,a2,a3,a4){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3,a4)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiiii(index,a1,a2,a3,a4,a5){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4,a5)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiiij(index,a1,a2,a3,a4,a5){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4,a5)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiiid(index,a1,a2,a3,a4,a5){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4,a5)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viii(index,a1,a2,a3){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiiiiii(index,a1,a2,a3,a4,a5,a6,a7){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiii(index,a1,a2,a3,a4){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_jiiii(index,a1,a2,a3,a4){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0);return 0n}}function invoke_fiii(index,a1,a2,a3){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_diii(index,a1,a2,a3){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_i(index){var sp=stackSave();try{return getWasmTableEntry(index)()}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viiiiiii(index,a1,a2,a3,a4,a5,a6,a7){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_iiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11){var sp=stackSave();try{return getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7,a8,a9,a10)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viiiiiiiiiiiiiii(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13,a14,a15)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viif(index,a1,a2,a3){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function invoke_viid(index,a1,a2,a3){var sp=stackSave();try{getWasmTableEntry(index)(a1,a2,a3)}catch(e){stackRestore(sp);if(e!==e+0)throw e;_setThrew(1,0)}}function callMain(args=[]){var entryFunction=_main;args.unshift(thisProgram);var argc=args.length;var argv=stackAlloc((argc+1)*4);var argv_ptr=argv;for(var arg of args){HEAPU32[argv_ptr>>2]=stringToUTF8OnStack(arg);argv_ptr+=4}HEAPU32[argv_ptr>>2]=0;try{var ret=entryFunction(argc,argv);exitJS(ret,true);return ret}catch(e){return handleException(e)}}function run(args=arguments_){if(runDependencies>0){dependenciesFulfilled=run;return}preRun();if(runDependencies>0){dependenciesFulfilled=run;return}function doRun(){Module["calledRun"]=true;if(ABORT)return;initRuntime();preMain();Module["onRuntimeInitialized"]?.();var noInitialRun=Module["noInitialRun"]||false;if(!noInitialRun)callMain(args);postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout(()=>{setTimeout(()=>Module["setStatus"](""),1);doRun()},1)}else{doRun()}}var wasmExports;createWasm();run();

// =============================================================================
// Shared state
// =============================================================================
//
// `bcts` and `fpqs` are kept parallel to `layouts`: for each index i,
// `layouts[i]` is the i-th 1-stack layout, `bcts[i]` is the (rooted) BCT that
// generated it, and `fpqs[i]` is the corresponding FPQ-tree. The C++ side
// emits the BCT and then the FPQ for a given layout *before* the matching
// "RESULT: ..." line (see the patched getNext() in main_enum.cpp), so by the
// time we push a new layout we already have its BCT and FPQ ready in
// `bcts[i]` / `fpqs[i]`.
//
// `blocks` holds, for each biconnected block, the list of its edges. It is
// emitted only once per WASM session (it is a static property of the input
// graph). `edgeToBlock` is a derived index that maps an edge key
// `"<from>-<to>"` to its block index, used by `drawLayout` to color edges
// after their block.
//
// The 24 default layouts are hardcoded as a fallback for the initial demo
// without WebAssembly: in that case `bcts`, `fpqs`, `blocks` are empty and
// the corresponding panels show a placeholder until the user clicks
// "Compute Layouts".
// =============================================================================

var graph = {
    nodes: [{"id": "0","label": "0"},{"id": "1","label": "1"},{"id": "2","label": "2"},{"id": "3","label": "3"},{"id": "4","label": "4"},{"id":"5","label": "5"},{"id": "6","label": "6"},{"id": "7","label": "7"},{"id": "8","label": "8"},{"id": "9","label": "9"},{"id":"10","label": "10"}],
    edges: [{"from": "0","to": "1"},{"from": "0","to": "2"},{"from": "0","to": "8"},{"from": "1","to": "2"},{"from": "1","to": "3"},{"from": "1","to": "10"},{"from": "4","to": "3"},{"from": "5","to": "3"},{"from": "6","to": "3"},{"from": "7","to": "3"},{"from": "7","to": "6"},{"from": "9","to": "6"}]
};
var layouts = [["0","8","1","10","4","5","7","9","6","3","2"],["0","8","1","4","5","7","9","6","3","10","2"],["0","8","1","10","4","7","9","6","5","3","2"],["0","8","1","4","7","9","6","5","3","10","2"],["0","8","1","10","5","4","7","9","6","3","2"],["0","8","1","5","4","7","9","6","3","10","2"],["0","8","1","10","5","7","9","6","4","3","2"],["0","8","1","5","7","9","6","4","3","10","2"],["0","8","1","10","7","9","6","4","5","3","2"],["0","8","1","7","9","6","4","5","3","10","2"],["0","8","1","10","7","9","6","5","4","3","2"],["0","8","1","7","9","6","5","4","3","10","2"],["0","1","10","4","5","7","9","6","3","2","8"],["0","1","4","5","7","9","6","3","10","2","8"],["0","1","10","4","7","9","6","5","3","2","8"],["0","1","4","7","9","6","5","3","10","2","8"],["0","1","10","5","4","7","9","6","3","2","8"],["0","1","5","4","7","9","6","3","10","2","8"],["0","1","10","5","7","9","6","4","3","2","8"],["0","1","5","7","9","6","4","3","10","2","8"],["0","1","10","7","9","6","4","5","3","2","8"],["0","1","7","9","6","4","5","3","10","2","8"],["0","1","10","7","9","6","5","4","3","2","8"],["0","1","7","9","6","5","4","3","10","2","8"]];
var bcts = [];          // filled by the WASM, parallel to `layouts`.
var fpqs = [];          // filled by the WASM, parallel to `layouts`.
var blocks = [];        // blocks[i] = array of edges {from,to} of the i-th biconnected block.
var edgeToBlock = new Map(); // key "<from>-<to>" -> block index. Built once from `blocks`.
var currentBCT = null;  // BCT being built while the C++ is still emitting it.
var currentFPQ = null;  // FPQ being built while the C++ is still emitting it.
var currentBlocks = null;     // blocks being built while the C++ is still emitting them.
var bctNetwork = null;        // last vis.Network drawn in the BCT panel (for refit on resize).
var fpqNetwork = null;        // last vis.Network drawn in the FPQ panel (for refit on resize).
var currentIndex = 0;
var numberOfLayouts = 24;

// =============================================================================
// Appearance constants (declared up-front so they are usable during the
// initial drawBCT/drawFPQ calls below; `const` declarations are subject to
// the temporal dead zone, so they MUST appear before any function that
// reads them is invoked at top level).
// =============================================================================

/**
 * Edge-color/label conventions for the BCT, encoding the role of the cutpoint
 * in the child block. Colors are deliberately dark/saturated so they remain
 * readable on top of the pastel block-chromatism palette.
 */
const BCT_EDGE_STYLE = {
    0: { color: '#1a7e1a', label: 's', name: 'source cutpoint' },
    1: { color: '#b71c1c', label: 'i', name: 'intermediate cutpoint' },
    2: { color: '#0d47a1', label: 't', name: 'sink cutpoint' }
};

/**
 * Pastel palette used to give every biconnected block a unique color.
 * Light enough to keep the dark BCT_EDGE_STYLE colors readable on top.
 * Cycles via modulo if the graph has more blocks than entries (large graphs
 * are rare in this didactic tool, and even with cycling adjacent blocks
 * typically get distinct colors).
 */
const BLOCK_COLOR_PALETTE = [
    '#f4a6a6', // pastel red
    '#f9c98a', // pastel orange
    '#f6e58d', // pastel yellow
    '#b8e0a6', // pastel green
    '#a6d8e0', // pastel cyan
    '#a6b8e0', // pastel blue
    '#c8a6e0', // pastel violet
    '#e0a6c8', // pastel pink
    '#d4b48a', // pastel tan
    '#8acabf', // pastel teal
    '#bfb48a', // pastel khaki
    '#b48ad4'  // pastel lavender
];

updateStatistics();
drawLayout(graph, layouts[currentIndex]);
drawBCT(bcts[currentIndex]);                  // shows the placeholder on first load.
drawFPQ(fpqs[currentIndex], bcts[currentIndex]); // idem.

// =============================================================================
// Graph file reading
// =============================================================================

/**
 * Read the content of the file currently selected in #fileInput as text.
 * @returns {Promise<string>} Resolves with the file content, rejects with an
 *                            error message if no file is chosen or reading fails.
 */
function fileToString() {
    return new Promise((resolve, reject) => {
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length === 0) {
            reject('Choose a file');
            return;
        }
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function() {
            try {
                resolve(reader.result);
            } catch (error) {
                reject('Error reading file: ' + error);
            }
        };
        reader.onerror = function() {
            reject('Error reading file: ' + reader.error);
        };
        reader.readAsText(file);
    });
}

// =============================================================================
// Buttons and user interaction
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('run').addEventListener('click', function() {
        fileToString()
            .then(fileString => {
                graph = getGraphFromFileString(fileString);
                layouts = [];
                bcts = [];
                fpqs = [];
                blocks = [];
                edgeToBlock = new Map();
                currentBCT = null;
                currentFPQ = null;
                currentBlocks = null;
                currentIndex = 0;
                // `callMain` is an Emscripten runtime method. Recent Emscripten
                // versions no longer leak it to the global scope, so resolve it
                // from the Module object (with a fallback to a bare global for
                // older builds). It must be listed in EXPORTED_RUNTIME_METHODS
                // at compile time, otherwise Module.callMain is undefined too.
                const wasmCallMain =
                    (typeof Module !== 'undefined' && Module.callMain) ||
                    (typeof callMain === 'function' ? callMain : null);
                if (typeof wasmCallMain !== 'function') {
                    console.error('callMain is not available: add "callMain" to ' +
                        'EXPORTED_RUNTIME_METHODS in compile-wasm.ps1 and rebuild.');
                    return;
                }
                wasmCallMain([fileString]);
                if (numberOfLayouts == 0) {
                    currentIndex = -1;
                    updateStatistics();
                    drawLayout({nodes: [], edges: []}, []);
                    drawBCT(null);
                    drawFPQ(null, null);
                }
                else {
                    updateStatistics();
                    drawLayout(graph, layouts[currentIndex]);
                    drawBCT(bcts[currentIndex]);
                    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
                }
            })
            .catch(error => {
                console.error('Error while reading the file:', error);
            });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('next').addEventListener('click', function() {
        fileToString()
            .then(fileString => {
                if (currentIndex == layouts.length - 1) {
                    // `_printNextLayout` is only present if exported via
                    // EXPORTED_FUNCTIONS. It currently is not (only `_main` is),
                    // and main() already enumerates every layout up-front, so
                    // this branch is a no-op. Guard it to avoid a TypeError if
                    // someone presses Next on the very last layout.
                    var computeNextLayout = (typeof Module !== 'undefined')
                        ? Module["_printNextLayout"] : null;
                    if (typeof computeNextLayout === 'function') {
                        computeNextLayout();
                    }
                }
                if (currentIndex < numberOfLayouts - 1) {
                    currentIndex++;
                    updateStatistics();
                    drawLayout(graph, layouts[currentIndex]);
                    drawBCT(bcts[currentIndex]);
                    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
                }
            })
            .catch(error => {
                if (currentIndex < numberOfLayouts - 1) {
                    currentIndex++;
                    updateStatistics();
                    drawLayout(graph, layouts[currentIndex]);
                    drawBCT(bcts[currentIndex]);
                    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
                }
            });
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('prev').addEventListener('click', function() {
        if (currentIndex > 0) {
            currentIndex--;
            updateStatistics();
            drawLayout(graph, layouts[currentIndex]);
            drawBCT(bcts[currentIndex]);
            drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('downloadGraph').addEventListener('click', function() {
        const graphString = getGraphString();
        const blob = new Blob([graphString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'graph';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});

document.getElementById('fileInput').addEventListener('change', function() {
    var fileName = this.files[0].name;
    document.getElementById('fileName').textContent = 'Selected file: ' + fileName;
    document.getElementById("run").style.display = "block";
});

// =============================================================================
// Graph (de)serialization to/from text file
// =============================================================================

/**
 * Serialize the current `graph` object into the text format expected by the
 * C++ side: nodes one per line, then edges as "from,to" lines.
 * @returns {string} Plain text representation of the graph.
 */
function getGraphString() {
    let graphString = "";
    graph.nodes.forEach((node) => graphString += node.id + "\n");
    graph.edges.forEach((edge) => graphString += edge.from + "," + edge.to + "\n");
    return graphString;
}

/**
 * Parse the textual graph description (same format as `getGraphString`) into
 * an in-memory `{ nodes, edges }` structure.
 * @param {string} fileString  Text content of a graph file.
 * @returns {{nodes: Array<{id:string,label:string}>, edges: Array<{from:string,to:string}>}}
 */
function getGraphFromFileString(fileString) {
    const G = { nodes: [], edges: [] };
    let i = 0;
    let current = "";
    let readingNodes = true;
    let sourceNode = -1;

    while (i < fileString.length) {
        if (fileString[i] == '\n') {
            if (readingNodes) {
                G.nodes.push({id: current, label: current});
            } else {
                G.edges.push({from: sourceNode, to: current});
            }
            current = "";
        } else if (fileString[i] == ',') {
            sourceNode = current;
            current = "";
            readingNodes = false;
        } else if (fileString[i] != '\r') {
            current = current + fileString[i];
        }
        i++;
    }
    if (current.length > 0) {
        if (readingNodes) {
            G.nodes.push({id: current, label: current});
        } else {
            G.edges.push({from: sourceNode, to: current});
        }
    }
    return G;
}

// =============================================================================
// Parsing of messages emitted by the WebAssembly module
// =============================================================================
//
// The C++ side writes various kinds of lines to stdout. They are forwarded
// here by the patch in update_binary.py (which replaces the `out` callback
// with `getDataFromWasm` inside put_char). The recognized prefixes are:
//
//   "NUMBER OF LAYOUTS: <n>"              -> updates numberOfLayouts
//   "RESULT: <v0> <v1> ..."               -> pushes a new layout
//
//   "BLOCKS_BEGIN count=<n>"              -> begin block decomposition
//   "BLOCK_EDGE block=<i> from=<u> to=<v>"
//   "BLOCKS_END"                          -> end block decomposition
//                                            (emitted ONCE per WASM session,
//                                            blocks are a static property of
//                                            the input graph)
//
//   "BCT_BEGIN root=<id>"                 -> begin BCT description
//   "BCT_NODE id=<id> kind=<block|cutpoint> value=<v>"
//   "BCT_EDGE from=<id> to=<id> type=<0|1|2>"
//   "BCT_END"                             -> end BCT description
//
//   "FPQ_BEGIN root=<id>"                 -> begin FPQ-tree description
//   "FPQ_NODE id=<id> type=<P|F_BLOCK|F_GADGET|LEAF> [block=<i>] [value=<v>]"
//   "FPQ_EDGE from=<id> to=<id> pos=<k>"  -> pos = child index inside its parent
//   "FPQ_END"                             -> end FPQ-tree description
//
// Everything else is debug output and ends up only in console.log.
// =============================================================================

/**
 * Dispatch a single stdout line emitted by the WASM module to the appropriate
 * state-updating branch. Unrecognized lines are simply logged.
 * @param {string} message  One full line of WASM stdout (no trailing newline).
 */
function getDataFromWasm(message) {
    console.log(message);

    if (typeof message !== 'string') return;

    // --- Blocks (biconnected decomposition, emitted once) ---
    if (message.startsWith('BLOCKS_BEGIN')) {
        const m = message.match(/count=(\d+)/);
        const count = m ? parseInt(m[1], 10) : 0;
        currentBlocks = [];
        for (let i = 0; i < count; i++) currentBlocks.push([]);
        return;
    }
    if (message.startsWith('BLOCK_EDGE')) {
        if (!currentBlocks) return;
        const b = parseInt(message.match(/block=(\d+)/)[1], 10);
        const from = parseInt(message.match(/from=(\d+)/)[1], 10);
        const to   = parseInt(message.match(/to=(\d+)/)[1], 10);
        if (currentBlocks[b]) currentBlocks[b].push({ from, to });
        return;
    }
    if (message.startsWith('BLOCKS_END')) {
        if (currentBlocks) {
            blocks = currentBlocks;
            edgeToBlock = buildEdgeToBlock(blocks);
            currentBlocks = null;
        }
        return;
    }

    // --- BCT ---
    if (message.startsWith('BCT_BEGIN')) {
        const m = message.match(/root=(-?\d+)/);
        currentBCT = {
            nodes: [],
            edges: [],
            root: m ? parseInt(m[1], 10) : null
        };
        return;
    }
    if (message.startsWith('BCT_NODE')) {
        if (!currentBCT) return;
        const id    = parseInt(message.match(/id=(\d+)/)[1], 10);
        const kind  = message.match(/kind=(\w+)/)[1];
        const value = parseInt(message.match(/value=(\d+)/)[1], 10);
        currentBCT.nodes.push({ id, kind, value });
        return;
    }
    if (message.startsWith('BCT_EDGE')) {
        if (!currentBCT) return;
        const from = parseInt(message.match(/from=(\d+)/)[1], 10);
        const to   = parseInt(message.match(/to=(\d+)/)[1], 10);
        const type = parseInt(message.match(/type=(\d+)/)[1], 10);
        currentBCT.edges.push({ from, to, type });
        return;
    }
    if (message.startsWith('BCT_END')) {
        if (currentBCT) {
            bcts.push(currentBCT);
            currentBCT = null;
        }
        return;
    }

    // --- FPQ ---
    if (message.startsWith('FPQ_BEGIN')) {
        const m = message.match(/root=(-?\d+)/);
        currentFPQ = {
            nodes: [],
            edges: [],
            root: m ? parseInt(m[1], 10) : null
        };
        return;
    }
    if (message.startsWith('FPQ_NODE')) {
        if (!currentFPQ) return;
        const id        = parseInt(message.match(/id=(\d+)/)[1], 10);
        const type      = message.match(/type=(\w+)/)[1];
        const blockMatch = message.match(/block=(\d+)/);
        const valueMatch = message.match(/value=(\d+)/);
        currentFPQ.nodes.push({
            id,
            type, // 'P' | 'F_BLOCK' | 'F_GADGET' | 'LEAF'
            blockIndex: blockMatch ? parseInt(blockMatch[1], 10) : -1,
            value:      valueMatch ? parseInt(valueMatch[1], 10) : -1
        });
        return;
    }
    if (message.startsWith('FPQ_EDGE')) {
        if (!currentFPQ) return;
        const from = parseInt(message.match(/from=(\d+)/)[1], 10);
        const to   = parseInt(message.match(/to=(\d+)/)[1], 10);
        const pos  = parseInt(message.match(/pos=(\d+)/)[1], 10);
        currentFPQ.edges.push({ from, to, pos });
        return;
    }
    if (message.startsWith('FPQ_END')) {
        if (currentFPQ) {
            fpqs.push(currentFPQ);
            currentFPQ = null;
        }
        return;
    }

    // --- Layout / counts ---
    if (message.startsWith('RESULT: ')) {
        let layout = message.replace('RESULT: ', '').split(' ').map(item => item.trim());
        layout.pop(); // strip the trailing empty token.
        layouts.push(layout);
        return;
    }
    if (message.startsWith('NUMBER OF LAYOUTS: ')) {
        numberOfLayouts = parseInt(message.replace('NUMBER OF LAYOUTS: ', '').split(' ').map(item => item.trim())[0], 10);
        updateStatistics();
        return;
    }
}

/**
 * Build the "edge -> block index" lookup map from the block decomposition.
 * The key encodes the unordered edge as "<min>-<max>" so that direction in
 * the layout view does not affect the lookup.
 * @param {Array<Array<{from:number,to:number}>>} blocksArr  Block list.
 * @returns {Map<string, number>} Map from edge key to block index.
 */
function buildEdgeToBlock(blocksArr) {
    const map = new Map();
    for (let i = 0; i < blocksArr.length; i++) {
        for (const e of blocksArr[i]) {
            const a = Math.min(e.from, e.to);
            const b = Math.max(e.from, e.to);
            map.set(a + '-' + b, i);
        }
    }
    return map;
}

/**
 * Look up the block index of an edge in O(1) regardless of orientation.
 * @param {string|number} from  Source endpoint of the edge.
 * @param {string|number} to    Target endpoint of the edge.
 * @returns {number}            Block index, or -1 if the edge is unknown
 *                              (typically before the WASM has been run).
 */
function blockOfEdge(from, to) {
    const a = Math.min(parseInt(from, 10), parseInt(to, 10));
    const b = Math.max(parseInt(from, 10), parseInt(to, 10));
    const v = edgeToBlock.get(a + '-' + b);
    return (v === undefined) ? -1 : v;
}

// =============================================================================
// Block-chromatism palette
// =============================================================================
//
// The `BLOCK_COLOR_PALETTE` array itself is declared near the top of the
// file (it is needed during the initial drawBCT/drawFPQ calls). Here we just
// define the accessor function and document the palette's role.
//
// Every biconnected block is assigned a unique pastel color. The palette is
// deliberately light so that the dark/saturated BCT edge colors (source/
// intermediate/sink) stay readable on top of it. If the input graph has more
// blocks than palette entries the colors cycle (acceptable: large graphs are
// rare in this didactic tool, and even with cycling adjacent blocks usually
// get distinct colors).
// =============================================================================

/**
 * Return the pastel color associated with a given block index. Cycles through
 * `BLOCK_COLOR_PALETTE` if the index exceeds the palette length.
 * @param {number} i  Block index (0-based).
 * @returns {string}  Hex color string, e.g. "#f4a6a6".
 */
function blockColor(i) {
    if (i < 0) return '#cccccc';
    return BLOCK_COLOR_PALETTE[i % BLOCK_COLOR_PALETTE.length];
}

function updateStatistics() {
    document.getElementById("index").innerText = "layout " + (currentIndex + 1) + " of " + numberOfLayouts;
}

// =============================================================================
// 1-stack layout drawing (top-right panel)
// =============================================================================
//
// Vertices are laid out on a horizontal line in the order given by `layout`,
// edges are drawn as curves above (or below) the line by vis-network's
// `curvedCW` smoothing. Each edge is colored after its biconnected block
// (block chromatism): edges in the same block share a color, which matches
// the color used for that block's node in the BCT and FPQ panels. If the
// block decomposition is not available yet (e.g. the initial demo without
// running the WASM), edges fall back to black.
// =============================================================================

/**
 * Draw the 1-stack layout in the #network DOM element.
 * @param {{nodes:Array,edges:Array}} graph   Graph being visualized.
 * @param {Array<string>}             layout  Vertex labels in the chosen
 *                                            stack order (left-to-right).
 */
function drawLayout(graph, layout) {
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();
    const mapping = new Map();

    let i = 0;
    layout.forEach(label => { mapping.set(label, i); i += 1; });

    // VERTICAL spine: nodes stacked top-to-bottom (x = 0); arcs bow to the RIGHT.
    const V = 75;
    graph.nodes.forEach(node => {
        nodes.add({ id: mapping.get(node.label), label: node.label, x: 0, y: -mapping.get(node.label) * V });
    });

    graph.edges.forEach(edge => {
        const b = blockOfEdge(edge.from, edge.to);
        const c = (b >= 0) ? blockColor(b) : 'black';
        edges.add({
            from: mapping.get(edge.from),
            to:   mapping.get(edge.to),
            color: { color: c, highlight: c, hover: c },
            width: 2
        });
    });

    // Reserve room on the RIGHT so the arcs are not clipped; the spine then sits
    // on the left of the panel. HEAD ~ the widest arc's rightward extent.
    let maxSpan = 0;
    graph.edges.forEach(edge => {
        const a = mapping.get(edge.from), bb = mapping.get(edge.to);
        if (a != null && bb != null) maxSpan = Math.max(maxSpan, Math.abs(a - bb));
    });
    const HEAD = maxSpan * V * 0.55;   // tune if arcs clip / too much room
    if (HEAD > 0) {
        const midY = -(i - 1) * V / 2;
        const invisible = {
            size: 0, shape: 'dot', label: '',
            color: { background: 'rgba(0,0,0,0)', border: 'rgba(0,0,0,0)' },
            physics: false, fixed: { x: true, y: true }
        };
        nodes.add(Object.assign({ id: '__padRight', x: HEAD,         y: midY }, invisible));
        nodes.add(Object.assign({ id: '__padLeft',  x: -HEAD * 0.10, y: midY }, invisible));
    }

    const options = {
        nodes: {
            color: { background: "#76e0f5", border: "black",
                     highlight: { background: "#bbffff", border: "black" } },
            font: { color: "black", size: 16 },
            borderWidth: 1
        },
        edges: {
            arrows: { to: true },
            smooth: { type: 'curvedCW' }   // se gli archi vanno a SINISTRA, usa 'curvedCCW'
        },
        interaction: { dragNodes: false },
        physics: { enabled: false }
    };

    const container = document.getElementById("network");
    const data = { nodes: nodes, edges: edges };
    const network = new vis.Network(container, data, options);
    network.setSize(container.offsetWidth, container.offsetHeight);
    network.once("afterDrawing", () => network.fit());
    network.on("doubleClick", () => network.fit());
    network.on("afterDrawing", function (ctx) {
        const dataURL = ctx.canvas.toDataURL();
        document.getElementById('canvasImg').href = dataURL;
    });
}

// =============================================================================
// BCT drawing (bottom-left panel)
// =============================================================================
//
// We use a manual "tidy tree" layout (same algorithm as drawFPQ) instead of
// vis-network's hierarchical layout, because we want absolute control over
// the left-to-right order of children: the C++ side emits BCT_EDGE entries
// in the order dictated by the current permutation (see
// orderedChildrenOfCutpoint in main_enum.cpp), and we must preserve that
// order so flipping through layouts visibly rearranges the BCT in lockstep
// with the layout itself.
//
// Graphical conventions:
//   - Block nodes (biconnected components):
//        rectangle filled with the block's chromatism color, label "B<i>".
//        Same color is used for the corresponding F_NODE_BLOCK in the FPQ
//        panel and for the edges of that block in the layout panel.
//   - Cutpoint nodes (cut vertices):
//        ellipse with the standard cyan background, label "<v>".
//   - Edge colors encode the role of the cutpoint in the child block,
//        deliberately chosen dark/saturated to contrast with the pastel
//        block palette:
//          type=0 (source cutpoint)       -> dark green   "s"
//          type=1 (intermediate cutpoint) -> dark red     "i"
//          type=2 (sink cutpoint)         -> dark blue    "t"
//
// A small legend is rendered below the network area so the meaning of the
// edge colors is self-documenting. The legend is inserted via inline CSS
// (no need to touch styles.css).
//
// The `BCT_EDGE_STYLE` map itself is declared near the top of the file
// (it is needed during the initial drawBCT call to render the legend).
// =============================================================================

/**
 * Ensure the BCT legend block exists in the DOM, sitting just below the
 * #bct-network panel. The legend lists the three edge-type colors. Idempotent:
 * if the legend is already in the DOM, it is left untouched.
 */
function ensureBCTLegend() {
    if (document.getElementById('bct-legend')) return;
    const host = document.getElementById('bct-network');
    if (!host || !host.parentElement) return;
    const legend = document.createElement('div');
    legend.id = 'bct-legend';
    legend.style.cssText = [
        'display:flex',
        'flex-wrap:wrap',
        'gap:12px',
        'align-items:center',
        'justify-content:center',
        'padding:4px 8px',
        'margin-top:4px',
        'font-size:12px',
        'color:#222',
        'font-family:sans-serif'
    ].join(';');
    const swatch = (color, label) => {
        const item = document.createElement('span');
        item.style.cssText = 'display:inline-flex;align-items:center;gap:4px;';
        const dot = document.createElement('span');
        dot.style.cssText = `display:inline-block;width:18px;height:3px;background:${color};border-radius:1px;`;
        const txt = document.createElement('span');
        txt.textContent = label;
        item.appendChild(dot);
        item.appendChild(txt);
        return item;
    };
    legend.appendChild(swatch(BCT_EDGE_STYLE[0].color, BCT_EDGE_STYLE[0].name));
    legend.appendChild(swatch(BCT_EDGE_STYLE[1].color, BCT_EDGE_STYLE[1].name));
    legend.appendChild(swatch(BCT_EDGE_STYLE[2].color, BCT_EDGE_STYLE[2].name));
    host.parentElement.insertBefore(legend, host.nextSibling);
}

/**
 * Draw the BCT corresponding to the current layout. Uses an explicit
 * "tidy tree" layout so that the visual order of children matches the order
 * in which the C++ emitted their edges (which itself reflects the current
 * permutation of cutpoint children).
 *
 * @param {?{nodes:Array,edges:Array,root:number}} bct  BCT description, or
 *      null/empty to draw the placeholder.
 */
function drawBCT(bct) {
    const container = document.getElementById('bct-network');

    if (!bct || !bct.nodes || bct.nodes.length === 0) {
        // Only inject a fallback placeholder if the container does not
        // already contain a `.placeholder` element. This way the placeholder
        // text defined in index.html survives the initial draw and the
        // HTML stays the single source of truth for the message shown when
        // no BCT is available.
        if (!container.querySelector('.placeholder')) {
            container.innerHTML =
                '<div class="placeholder">Upload Graph File and press Compute Layouts to visualize the BCT for the current layout.</div>';
        }
        ensureBCTLegend();
        bctNetwork = null;
        return;
    }

    container.innerHTML = '';

    // --- Build "children of X, in emission order" index. --------------------
    // BCT_EDGE messages are emitted in the order dictated by the current
    // permutation, so simply preserving their relative order is enough.
    const childrenOf = new Map();
    for (const n of bct.nodes) childrenOf.set(n.id, []);
    for (const e of bct.edges) {
        const arr = childrenOf.get(e.from);
        if (arr) arr.push(e.to);
    }

    // --- Tidy-tree layout (same recursive scheme used in drawFPQ). ----------
    const positions = new Map();
    function layoutSubtree(nodeId, depth, xStart) {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            const c = xStart + 0.5;
            positions.set(nodeId, { x: c, level: depth });
            return { width: 1, center: c };
        }
        let x = xStart;
        const childCenters = [];
        for (const child of children) {
            const r = layoutSubtree(child, depth + 1, x);
            childCenters.push(r.center);
            x += r.width;
        }
        const center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
        positions.set(nodeId, { x: center, level: depth });
        return { width: x - xStart, center: center };
    }

    if (bct.root != null && childrenOf.has(bct.root)) {
        layoutSubtree(bct.root, 0, 0);
    } else {
        // Defensive fallback: shouldn't happen if C++ always emits BCT_BEGIN root=...
        let i = 0;
        for (const n of bct.nodes) positions.set(n.id, { x: i++, level: 0 });
    }

    const X_UNIT = 70;
    const Y_UNIT = 70;

    const visNodes = new vis.DataSet(bct.nodes.map(n => {
        const p = positions.get(n.id) || { x: 0, level: 0 };
        if (n.kind === 'block') {
            return {
                id: n.id,
                label: 'B' + n.value,
                shape: 'box',
                color: { background: blockColor(n.value), border: 'black' },
                font: { color: 'black', size: 14 },
                borderWidth: 1,
                x: p.x * X_UNIT,
                y: p.level * Y_UNIT,
                fixed: { x: true, y: true }
            };
        }
        // Cutpoint
        return {
            id: n.id,
            label: String(n.value),
            shape: 'ellipse',
            color: { background: '#76e0f5', border: 'black' },
            font: { color: 'black', size: 14 },
            borderWidth: 1,
            x: p.x * X_UNIT,
            y: p.level * Y_UNIT,
            fixed: { x: true, y: true }
        };
    }));

    const visEdges = new vis.DataSet(bct.edges.map(e => {
        const style = BCT_EDGE_STYLE[e.type] || { color: 'black', label: '?' };
        return {
            from: e.from,
            to: e.to,
            label: style.label,
            color: { color: style.color },
            font: { size: 11, color: style.color, strokeWidth: 0, align: 'middle' },
            arrows: { to: { enabled: false } },
            smooth: false,
            width: 1.5
        };
    }));

    const options = {
        layout: { hierarchical: { enabled: false }, randomSeed: 0 },
        physics: { enabled: false },
        interaction: { dragNodes: false, zoomView: true },
        autoResize: false // we refit explicitly via observeNetPanel's ResizeObserver.
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    network.once("afterDrawing", () => network.fit());

    bctNetwork = network;
    observeNetPanel('bct-network');
    ensureBCTLegend();
}

// =============================================================================
// FPQ-tree drawing (bottom-right panel)
// =============================================================================
//
// Graphical conventions (kept consistent with the BCT panel where it makes
// sense, to ease cross-reading):
//   - F_BLOCK  (one for each biconnected block) -> rectangle filled with the
//                                                   block's chromatism color,
//                                                   label "B<i>"
//   - F_GADGET (cutpoint gadget wrapper)         -> small empty grey rectangle
//   - P_NODE   (free permutation of children)    -> light green ellipse, "P"
//   - LEAF, cutpoint vertex                      -> cyan ellipse, "<v>"
//   - LEAF, regular vertex                       -> bare text, "<v>"
//
// To distinguish "cutpoint leaf" from "regular leaf" we need to know which
// graph vertices are cutpoints: we recover that from the corresponding BCT
// passed as the second argument. By construction `bcts[i]` and `fpqs[i]`
// are paired.
//
// LAYOUT: explicit (x, y) coordinates are computed via the classic recursive
// "tidy tree" / subtree-width algorithm; vis-network's own hierarchical
// layout is disabled. The FPQ-tree is a strict tree (one parent per node,
// no cycles), so this layout produces zero crossings. It also respects the
// `pos` ordering of children, which is significant for F-nodes (and for
// P-nodes it encodes the current permutation).
//
// Algorithm:
//   - every leaf occupies one horizontal slot;
//   - every internal node is centered on the midpoint between its first and
//     its last child;
//   - children are visited in order of `pos`.
// =============================================================================

/**
 * Draw the FPQ-tree associated with the current layout.
 * @param {?{nodes:Array,edges:Array,root:number}} fpq  FPQ-tree description.
 * @param {?{nodes:Array,edges:Array,root:number}} bct  Companion BCT (used to
 *      identify which leaf values correspond to cutpoints).
 */
function drawFPQ(fpq, bct) {
    const container = document.getElementById('fpq-network');

    if (!fpq || !fpq.nodes || fpq.nodes.length === 0) {
        // See note in drawBCT: do not clobber a placeholder already defined
        // in the HTML; the HTML is the single source of truth for this text.
        if (!container.querySelector('.placeholder')) {
            container.innerHTML =
                '<div class="placeholder">Upload Graph File and press Compute Layouts to visualize the FPQ tree for the current layout.</div>';
        }
        setFPQPanelHeight(300); // back to the standard panel height.
        fpqNetwork = null;
        return;
    }

    container.innerHTML = '';

    // Set of cutpoint vertex values, recovered from the companion BCT.
    const cutpointValues = new Set();
    if (bct && bct.nodes) {
        for (const n of bct.nodes) {
            if (n.kind === 'cutpoint') cutpointValues.add(n.value);
        }
    }

    // --- Build children index, sorted by `pos`. ----------------------------
    const childrenOf = new Map();
    for (const n of fpq.nodes) childrenOf.set(n.id, []);
    const sortedEdges = [...fpq.edges].sort((a, b) => {
        if (a.from !== b.from) return a.from - b.from;
        return a.pos - b.pos;
    });
    for (const e of sortedEdges) {
        const arr = childrenOf.get(e.from);
        if (arr) arr.push(e.to);
    }

    // --- Recursive tidy-tree layout. ---------------------------------------
    // positions: id -> { x, level } in abstract coordinates (slot = 1 unit).
    const positions = new Map();

    function layoutSubtree(nodeId, depth, xStart) {
        const children = childrenOf.get(nodeId) || [];
        if (children.length === 0) {
            const c = xStart + 0.5; // center the leaf inside its slot.
            positions.set(nodeId, { x: c, level: depth });
            return { width: 1, center: c };
        }
        let x = xStart;
        const childCenters = [];
        for (const child of children) {
            const r = layoutSubtree(child, depth + 1, x);
            childCenters.push(r.center);
            x += r.width;
        }
        const center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
        positions.set(nodeId, { x: center, level: depth });
        return { width: x - xStart, center: center };
    }

    if (fpq.root != null && childrenOf.has(fpq.root)) {
        layoutSubtree(fpq.root, 0, 0);
    } else {
        // Fallback: if for any reason there is no clear root, place nodes
        // arbitrarily (this should not happen in practice).
        let i = 0;
        for (const n of fpq.nodes) {
            positions.set(n.id, { x: i++, level: 0 });
        }
    }

    // Pixels per horizontal / vertical slot. Increase X_UNIT if nodes look
    // too close, Y_UNIT if the levels are too squashed together.
    const X_UNIT = 60;
    const Y_UNIT = 75;

    // Size the FPQ panel to the tree's vertical extent: a small (shallow) tree
    // keeps the standard panel height, a deep tree gets a taller panel (up to a
    // cap) so it is drawn larger instead of being zoomed down to fit. The width
    // is left to the grid column (kept fixed so the two bottom panels stay
    // aligned); very wide trees are handled by network.fit() + pan/zoom.
    let maxLevel = 0;
    for (const p of positions.values()) if (p.level > maxLevel) maxLevel = p.level;
    const STD_H = 300, MAX_H = 840, CHROME = 64;
    let targetH = (maxLevel + 2) * Y_UNIT + CHROME;
    targetH = Math.max(STD_H, Math.min(MAX_H, targetH));
    setFPQPanelHeight(targetH);

    const visNodes = new vis.DataSet(fpq.nodes.map(n => {
        const p = positions.get(n.id) || { x: 0, level: 0 };
        const base = {
            id: n.id,
            x: p.x * X_UNIT,
            y: p.level * Y_UNIT,
            fixed: { x: true, y: true }
        };

        switch (n.type) {
            case 'F_BLOCK':
                return Object.assign(base, {
                    label: 'B' + n.blockIndex,
                    shape: 'box',
                    color: { background: blockColor(n.blockIndex), border: 'black' },
                    font: { color: 'black', size: 14 },
                    borderWidth: 1
                });
            case 'F_GADGET':
                return Object.assign(base, {
                    label: ' ',
                    shape: 'box',
                    color: { background: '#e8e8e8', border: '#888' },
                    font: { color: '#888', size: 1 },
                    borderWidth: 1,
                    widthConstraint: { minimum: 24 },
                    heightConstraint: { minimum: 14 }
                });
            case 'P':
                return Object.assign(base, {
                    label: 'P',
                    shape: 'ellipse',
                    color: { background: '#b6f0b6', border: 'black' },
                    font: { color: 'black', size: 14 },
                    borderWidth: 1
                });
            case 'LEAF':
            default: {
                const isCp = cutpointValues.has(n.value);
                if (isCp) {
                    return Object.assign(base, {
                        label: String(n.value),
                        shape: 'ellipse',
                        color: { background: '#76e0f5', border: 'black' },
                        font: { color: 'black', size: 14 },
                        borderWidth: 1
                    });
                }
                return Object.assign(base, {
                    label: String(n.value),
                    shape: 'text',
                    font: { color: 'black', size: 14 }
                });
            }
        }
    }));

    const visEdges = new vis.DataSet(sortedEdges.map(e => ({
        from: e.from,
        to: e.to,
        color: { color: '#666' },
        arrows: { to: { enabled: false } },
        smooth: false, // straight lines look better in a clean tree layout.
        width: 1
    })));

    const options = {
        layout: { hierarchical: { enabled: false }, randomSeed: 0 },
        physics: { enabled: false },
        interaction: { dragNodes: false, zoomView: true },
        autoResize: false // we refit explicitly via observeNetPanel's ResizeObserver.
    };

    const network = new vis.Network(container, { nodes: visNodes, edges: visEdges }, options);
    network.on("doubleClick", () => network.fit());
    // Auto-fit zoom to the panel size on the first draw.
    network.once("afterDrawing", () => network.fit());

    fpqNetwork = network;
    observeNetPanel('fpq-network');
}

// =============================================================================
// PNG Download buttons
// =============================================================================
//
// Each of the 3 graphic panels (1-stack layout, BCT, FPQ) gets a small button
// in its top-right corner that saves the panel's canvas as a PNG file. The
// pre-existing "Download Image" label in the controls panel (which used to
// save only the 1-stack layout via a hidden input + #canvasImg anchor) is
// repurposed in place to trigger the download of all 3 panels at once: it
// keeps its `.btn-left` styling, font, background, position, and the camera
// icon to the right of the label, but its text is changed and its click
// handler is rewired.
//
// Buttons are wired via JS (idempotent, same pattern as ensureBCTLegend), so
// no changes are required in either index.html.
//
// Filename convention: `<prefix>-<k>.png` where k is the 1-based layout number
// shown in the navigation bar ("layout X of Y"). Examples for layout 17:
//   layout-17.png   bct-17.png   fpq-17.png
// =============================================================================

/**
 * Ensure a download button is present in each graphic panel and that the
 * existing "Download Image" label has been repurposed to download all 3
 * panels. Idempotent.
 */
function ensureDownloadButtons() {
    addPanelDownloadButton('network',     'Download 1-stack layout as PNG', 'layout');
    addPanelDownloadButton('bct-network', 'Download BCT as PNG',            'bct');
    addPanelDownloadButton('fpq-network', 'Download FPQ tree as PNG',       'fpq');
    repurposeImageDownloadButton();
}

/**
 * Inject a small download button in the top-right corner of the panel that
 * hosts the given vis-network container. The panel is given `position:relative`
 * (if it isn't already) so the absolutely-positioned button anchors to it.
 * @param {string} containerId    ID of the vis-network container element.
 * @param {string} title          Tooltip / accessible label.
 * @param {string} fileNamePrefix Prefix for the generated filename.
 */
function addPanelDownloadButton(containerId, title, fileNamePrefix) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const panel = container.parentElement;
    if (!panel) return;
    if (panel.querySelector('.panel-download-btn')) return; // already added
    const cs = window.getComputedStyle(panel);
    if (!cs.position || cs.position === 'static') panel.style.position = 'relative';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-download-btn';
    btn.title = title;
    btn.textContent = '\u2B07 PNG'; // down arrow + PNG
    btn.style.cssText =
        'position:absolute; top:6px; right:8px; z-index:5; ' +
        'font-size:11px; padding:2px 8px; cursor:pointer; ' +
        'background:#ffffff; border:1px solid #cccccc; border-radius:3px;';
    btn.addEventListener('click', () => downloadPanelImage(containerId, fileNamePrefix));
    panel.appendChild(btn);
}

/**
 * Take over the visible "Download Image" control in the controls panel and
 * turn it into the trigger for downloading all 3 panel images at once.
 *
 * The visible control is the <label for="imageDownload" class="btn-left">.
 * It carries the .btn-left CSS class (so box / font / background / position
 * are defined by styles.css) and a Font Awesome camera icon to the right of
 * the label text. We modify the label IN PLACE so all of this styling is
 * preserved exactly:
 *   - drop the `for` attribute so clicking no longer fires the hidden
 *     #imageDownload input that drove the old single-image download path;
 *   - update the <span class="btn-text"> text to "Download all images";
 *   - keep the existing camera icon (or restore it defensively);
 *   - install a click listener that calls downloadAllPanels().
 *
 * The hidden helper input (#imageDownload) and the helper anchor (#canvasImg)
 * are no longer needed and are tidied up: the input is removed, the anchor
 * stays in the DOM (drawLayout's afterDrawing handler keeps referring to it
 * by id) but is emptied, stripped of its `download` attribute and hidden.
 *
 * The dataset flag prevents duplicate wiring on repeated calls.
 */
function repurposeImageDownloadButton() {
    const label = document.querySelector('label[for="imageDownload"]');
    if (!label) return;
    if (label.dataset.repurposed === '1') return;

    // Disarm the native label->input click forwarding.
    label.removeAttribute('for');

    // Update the visible text; the camera icon next to it stays in place.
    const textSpan = label.querySelector('.btn-text');
    if (textSpan) textSpan.textContent = 'Download all images';

    // Defensive: ensure the icon is the camera one (it already is per the
    // current HTML, but this makes the wiring resilient to small markup
    // changes).
    const icon = label.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-camera fa-lg';

    // Now route clicks to our handler.
    label.style.cursor = 'pointer';
    label.addEventListener('click', (e) => {
        e.preventDefault();
        downloadAllPanels();
    });
    label.dataset.repurposed = '1';

    // Tidy up the now-dead helper input that used to forward clicks to the
    // anchor. Removing it is safe because nothing else references it.
    const hidden = document.getElementById('imageDownload');
    if (hidden) hidden.remove();

    // Keep #canvasImg in the DOM because drawLayout's afterDrawing handler
    // still calls document.getElementById('canvasImg').href = dataURL on each
    // redraw; calling it on a missing element would throw. We just make sure
    // it has no content and isn't visible.
    const anchor = document.getElementById('canvasImg');
    if (anchor) {
        anchor.textContent = '';
        anchor.removeAttribute('download');
        anchor.style.display = 'none';
    }
}

/**
 * Save the canvas drawn inside a given vis-network container as a PNG file.
 * No-op if the canvas hasn't been rendered yet (e.g. before the WASM has run
 * for the BCT/FPQ panels). The filename is `<prefix>-<k>.png` with k = 1-based
 * layout number (matches the "layout X of Y" display).
 * @param {string} containerId  ID of the vis-network container element.
 * @param {string} prefix       Filename prefix.
 */
function downloadPanelImage(containerId, prefix) {
    const canvas = document.querySelector('#' + containerId + ' canvas');
    if (!canvas) {
        console.warn('downloadPanelImage: no canvas in #' + containerId +
                     ' (panel not rendered yet)');
        return;
    }
    const k = (typeof currentIndex === 'number' && currentIndex >= 0)
              ? (currentIndex + 1) : 0;
    const filename = prefix + '-' + k + '.png';
    const dataURL = canvas.toDataURL('image/png');
    triggerImageDownload(dataURL, filename);
}

/**
 * Download all 3 graphic panels of the currently displayed layout as three
 * separate PNG files. Panels that haven't been rendered yet are skipped (a
 * warning is logged for each).
 *
 * Note: some browsers (notably Chrome) ask the user to allow multiple
 * downloads from the same site the first time this happens. Accept and the
 * three files will arrive in the usual download folder.
 */
function downloadAllPanels() {
    const targets = [
        { container: 'network',     prefix: 'layout' },
        { container: 'bct-network', prefix: 'bct'    },
        { container: 'fpq-network', prefix: 'fpq'    }
    ];
    let downloaded = 0;
    for (const t of targets) {
        if (document.querySelector('#' + t.container + ' canvas')) {
            downloadPanelImage(t.container, t.prefix);
            downloaded++;
        } else {
            console.warn('downloadAllPanels: skipping #' + t.container +
                         ' (no canvas rendered)');
        }
    }
    if (downloaded === 0) {
        console.warn('downloadAllPanels: nothing to download \u2014 run an ' +
                     'enumeration first (Compute Layouts).');
    }
}

/**
 * Create a hidden anchor and click it to save a data URL as a file. The
 * anchor lives in the DOM only long enough to be activated, then is removed.
 * @param {string} dataURL   Data URL produced by HTMLCanvasElement.toDataURL.
 * @param {string} filename  Filename presented to the user in the save dialog.
 */
function triggerImageDownload(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// --- Wiring ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    ensureDownloadButtons();
});
// =============================================================================
// Ranking / Unranking controls
// =============================================================================
//
// The C++ enumerator (see main_enum.cpp / main()) emits every layout in a
// fixed canonical order:
//
//     for each rooting rho in `rootings` (in order):
//         for each permutation pi (lexicographic, via std::next_permutation
//                                  on the cutpoint children in BFS order):
//             emit layout(rho, pi)
//
// Therefore the position of a layout in the parallel arrays `layouts[]`,
// `bcts[]`, `fpqs[]` IS its rank. Consequences (all O(1), pure JS, no need to
// touch the C++):
//   - RANK    (current layout -> integer): `currentIndex`.
//   - UNRANK  (integer k -> layout): set `currentIndex = k` and redraw.
//
// The set of layouts sharing the same rooting is exactly one contiguous run in
// the arrays. Grouping `bcts[]` by the *root block* of each entry recovers the
// rootings: each run is one admissible root block, and its length is the number
// of permutations of that rooting (N_rho = product of the factorials of the
// P-node sizes). This is what feeds the segmented bar:
//   - one segment per admissible root block,
//   - segment width proportional to its layout count,
//   - segment colored with the block-chromatism color (same color the block
//     gets in the BCT and as F_BLOCK in the FPQ tree),
//   - segment labeled "B<i>" with its inclusive rank range "<start>-<end>".
//
// Identifiers shown in the UI are 1-based, matching the "layout X of Y"
// navigation bar at the bottom: the rank readout, the unrank range and the
// segment ranges all use the same numbering as the arrows, so the numbers line
// up exactly. Internally `currentIndex` and the group start/end stay 0-based
// (they index the parallel arrays); the +1 is applied only at display time, and
// the unrank input is converted back with -1. (Note: the Di Battista/Grosso/
// Maragno/Patrignani ranking paper uses 0-based ranks; switching back is just a
// matter of dropping the +1/-1 offsets here.)
// =============================================================================

/**
 * Groups of consecutive layouts sharing the same rooting (admissible root
 * block). Rebuilt lazily from `bcts[]`. Each entry:
 *   { rootBlock:<blockIndex>, start:<firstRank>, count:<n>, end:<lastRank> }
 * @type {Array<{rootBlock:number,start:number,count:number,end:number}>}
 */
var rootingGroups = [];

/** `bcts.length` the groups were last built for (cache key). @type {number} */
var rootingGroupsForLength = -1;

/** `rootingGroupsForLength` the bar segments were last rendered for. */
var rankBarBuiltForLength = -2;

/**
 * Total number of enumerated layouts currently available. After "Compute
 * Layouts" this equals `bcts.length`; for the initial hard-coded demo (no
 * WASM, empty `bcts`) it falls back to `numberOfLayouts`.
 * @returns {number}
 */
function rankTotal() {
    return (bcts.length > 0) ? bcts.length : numberOfLayouts;
}

/**
 * Root block index of a given BCT entry. The BCT root TreeNode is a block node
 * whose `value` is the biconnected-block index (same index used by
 * `blockColor` and by the FPQ F_BLOCK nodes). Falls back to the FPQ root's
 * `blockIndex` if, for any reason, the BCT root node is not a block.
 * @param {{root:number,nodes:Array}} bct  BCT description.
 * @param {number} i                       Index into the parallel arrays.
 * @returns {number} Block index, or -1 if undeterminable.
 */
function rootBlockValueOf(bct, i) {
    if (bct && bct.nodes != null && bct.root != null) {
        for (const n of bct.nodes) {
            if (n.id === bct.root) {
                if (n.kind === 'block') return n.value;
                break;
            }
        }
    }
    const fpq = fpqs[i];
    if (fpq && fpq.nodes) {
        for (const n of fpq.nodes) {
            if (n.id === fpq.root && n.type === 'F_BLOCK') return n.blockIndex;
        }
    }
    return -1;
}

/**
 * (Re)build `rootingGroups` from `bcts[]` if the data changed since last time.
 * Cheap to call on every refresh: it no-ops unless `bcts.length` changed.
 */
function rebuildRootingGroupsIfNeeded() {
    if (bcts.length === rootingGroupsForLength && rootingGroups.length > 0) return;
    rootingGroupsForLength = bcts.length;
    rootingGroups = [];
    for (let i = 0; i < bcts.length; i++) {
        const rb = rootBlockValueOf(bcts[i], i);
        const last = rootingGroups[rootingGroups.length - 1];
        if (!last || last.rootBlock !== rb) {
            rootingGroups.push({ rootBlock: rb, start: i, count: 1 });
        } else {
            last.count++;
        }
    }
    for (const g of rootingGroups) g.end = g.start + g.count - 1;
}

/**
 * Decompose a global rank into (rooting, perm).
 * @param {number} k Global 0-based rank.
 * @returns {?{rooting:number,perm:number,rootBlock:number,count:number}}
 *          null if k is outside every group.
 */
function decomposeRank(k) {
    for (let r = 0; r < rootingGroups.length; r++) {
        const g = rootingGroups[r];
        if (k >= g.start && k <= g.end) {
            return { rooting: r, perm: k - g.start, rootBlock: g.rootBlock, count: g.count };
        }
    }
    return null;
}

/**
 * Compose a (rooting, perm) pair back into a global rank.
 * @param {number} rooting Index into `rootingGroups`.
 * @param {number} perm    Permutation index within that rooting.
 * @returns {number} Global rank, or -1 if either index is out of range.
 */
function composeRank(rooting, perm) {
    if (rooting < 0 || rooting >= rootingGroups.length) return -1;
    const g = rootingGroups[rooting];
    if (perm < 0 || perm >= g.count) return -1;
    return g.start + perm;
}

/**
 * Parse the unrank text field. Accepts a single global rank, e.g. "17".
 * @param {string} text Raw input.
 * @returns {{ok:true,k:number}|{ok:false,msg:string}}
 */
function parseUnrank(text) {
    const t = String(text).trim();
    if (t === '') return { ok: false, msg: 'Empty input' };
    const m = t.match(/^(\d+)$/);
    if (m) return { ok: true, k: parseInt(m[1], 10) };
    return { ok: false, msg: 'Enter a whole number' };
}

/**
 * Jump to the layout of a given global rank, redrawing all panels. The wrapped
 * `updateStatistics` (see below) refreshes the ranking UI as a side effect.
 * @param {number} k Global 0-based rank.
 * @returns {boolean} true if the jump happened, false if k was out of range.
 */
function goToLayout(k) {
    const N = rankTotal();
    if (!(Number.isInteger(k) && k >= 0 && k < N)) return false;
    currentIndex = k;
    updateStatistics();
    drawLayout(graph, layouts[currentIndex]);
    drawBCT(bcts[currentIndex]);
    drawFPQ(fpqs[currentIndex], bcts[currentIndex]);
    return true;
}

// --- UI ----------------------------------------------------------------------

/**
 * Inject styling for the Controls panel (#buttons): shrink the control buttons
 * (.btn-left) so the whole content — including the ranking section — fits inside
 * the fixed-height panel without overflowing. All .btn-left buttons share the
 * rule, so they stay equal in size to one another. An id selector (#buttons ...)
 * overrides whatever the .btn-left rules in styles.css set, so this needs no
 * change to the stylesheet. Idempotent.
 */
function ensureControlsPanelStyle() {
    if (document.getElementById('controls-style')) return;
    const st = document.createElement('style');
    st.id = 'controls-style';
    st.textContent =
        // Compact, uniformly-sized control buttons.
        '#buttons .btn-left{padding:5px 10px;font-size:13px;line-height:1.2;' +
        'min-height:0;height:auto;margin-bottom:6px;}' +
        '#buttons .btn-left i{font-size:1em;}' +
        '#buttons #fileName{margin:4px 0;font-size:12px;}';
    (document.head || document.documentElement).appendChild(st);
}

/**
 * Inject the ranking/unranking controls into the bottom of the Controls panel
 * (#buttons), below the download buttons. Idempotent (same pattern as
 * ensureBCTLegend / ensureDownloadButtons), so no changes are needed in either
 * index.html. The segmented bar, the rank readout and the unrank input are all
 * built here once; their dynamic content is refreshed by refreshRankUI().
 */
function ensureRankingControls() {
    if (document.getElementById('ranking-controls')) return;
    const host = document.getElementById('buttons');
    if (!host) return;

    const wrap = document.createElement('div');
    wrap.id = 'ranking-controls';
    wrap.style.cssText =
        'margin-top:8px; padding-top:8px; border-top:1px solid #ddd; ' +
        'font-family:sans-serif; color:#222;';

    const title = document.createElement('div');
    title.textContent = 'Ranking / Unranking';
    title.style.cssText = 'font-weight:600; margin-bottom:2px;';
    wrap.appendChild(title);

    const sub = document.createElement('div');
    sub.textContent = 'Permutation map \u2014 one segment per admissible root block';
    sub.style.cssText = 'font-size:11px; color:#666; margin-bottom:4px;';
    wrap.appendChild(sub);

    // Segmented bar + position marker.
    const barWrap = document.createElement('div');
    barWrap.id = 'rank-bar-wrap';
    barWrap.style.cssText = 'position:relative; margin:4px 0 8px;';

    const bar = document.createElement('div');
    bar.id = 'rank-bar';
    bar.style.cssText =
        'display:flex; height:32px; border:1px solid #bbb; ' +
        'border-radius:4px; overflow:hidden; background:#f3f3f3;';
    barWrap.appendChild(bar);

    const marker = document.createElement('div');
    marker.id = 'rank-marker';
    marker.style.cssText =
        'position:absolute; top:-4px; height:40px; width:0; ' +
        'transform:translateX(-50%); pointer-events:none; ' +
        'border-left:2px solid #111; display:none;';
    const tri = document.createElement('div');
    tri.style.cssText =
        'position:absolute; top:-1px; left:-4px; width:0; height:0; ' +
        'border-left:4px solid transparent; border-right:4px solid transparent; ' +
        'border-top:6px solid #111;';
    marker.appendChild(tri);
    barWrap.appendChild(marker);

    wrap.appendChild(barWrap);

    // Rank readout + inline navigation arrows (so you can step through layouts
    // without scrolling down to the bottom navigation bar).
    const rankRow = document.createElement('div');
    rankRow.style.cssText = 'margin-bottom:8px;';

    const rankLbl = document.createElement('div');
    rankLbl.textContent = 'Rank (current layout)';
    rankLbl.style.cssText = 'font-size:13px; margin-bottom:2px;';

    const navRow = document.createElement('div');
    navRow.style.cssText =
        'display:flex; align-items:center; justify-content:center; gap:10px; ' +
        'background:#fafafa; border:1px solid #e0e0e0; border-radius:3px; padding:3px 6px;';

    const prevBtn = document.createElement('button');
    prevBtn.id = 'rank-prev';
    prevBtn.type = 'button';
    prevBtn.title = 'Previous layout';
    prevBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
    prevBtn.style.cssText =
        'border:none; background:transparent; cursor:pointer; ' +
        'font-size:15px; padding:2px 8px; color:#08175a;';

    const rankVal = document.createElement('span');
    rankVal.id = 'rank-current';
    rankVal.innerHTML = '&mdash;';
    rankVal.style.cssText =
        'font-family:monospace; font-size:13px; min-width:96px; text-align:center;';

    const nextBtn = document.createElement('button');
    nextBtn.id = 'rank-next';
    nextBtn.type = 'button';
    nextBtn.title = 'Next layout';
    nextBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
    nextBtn.style.cssText =
        'border:none; background:transparent; cursor:pointer; ' +
        'font-size:15px; padding:2px 8px; color:#08175a;';

    navRow.appendChild(prevBtn);
    navRow.appendChild(rankVal);
    navRow.appendChild(nextBtn);

    const rankDetail = document.createElement('div');
    rankDetail.id = 'rank-detail';
    rankDetail.style.cssText =
        'font-size:11px; color:#666; text-align:center; min-height:14px; margin-top:3px;';

    rankRow.appendChild(rankLbl);
    rankRow.appendChild(navRow);
    rankRow.appendChild(rankDetail);
    wrap.appendChild(rankRow);

    prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) goToLayout(currentIndex - 1);
    });
    nextBtn.addEventListener('click', () => {
        if (currentIndex < rankTotal() - 1) goToLayout(currentIndex + 1);
    });

    // Unrank input.
    const unrankRow = document.createElement('div');
    const unrankLbl = document.createElement('label');
    unrankLbl.setAttribute('for', 'unrank-input');
    unrankLbl.style.cssText = 'display:block; font-size:13px; margin-bottom:2px;';
    unrankLbl.innerHTML =
        'Unrank <span style="color:#666;">(go to rank <span id="unrank-hint">&mdash;</span>)</span>';
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; gap:6px; align-items:center;';
    const input = document.createElement('input');
    input.id = 'unrank-input';
    input.type = 'text';
    input.placeholder = 'e.g. 10';
    input.style.cssText = 'flex:1 1 auto; min-width:0; padding:4px 6px;';
    const goBtn = document.createElement('button');
    goBtn.id = 'unrank-go';
    goBtn.type = 'button';
    goBtn.textContent = 'Go';
    goBtn.style.cssText = 'flex:0 0 auto; padding:4px 12px; cursor:pointer;';
    inputRow.appendChild(input);
    inputRow.appendChild(goBtn);
    const err = document.createElement('div');
    err.id = 'unrank-error';
    err.style.cssText = 'color:#b71c1c; font-size:12px; min-height:14px; margin-top:2px;';
    unrankRow.appendChild(unrankLbl);
    unrankRow.appendChild(inputRow);
    unrankRow.appendChild(err);
    wrap.appendChild(unrankRow);

    host.appendChild(wrap);

    // Wiring.
    goBtn.addEventListener('click', handleUnrank);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleUnrank(); }
    });
}

/**
 * Rebuild the segments of the rank bar from `rootingGroups`. One flex child per
 * rooting, width proportional to its layout count, filled with the block color
 * and labeled "B<i>" plus its inclusive rank range. Clicking a segment jumps to
 * the first layout of that rooting. When no structure is available yet (initial
 * demo, before Compute Layouts) a single hint cell is shown instead.
 */
function renderRankBarSegments() {
    const bar = document.getElementById('rank-bar');
    if (!bar) return;
    bar.innerHTML = '';

    if (rootingGroups.length === 0) {
        const ph = document.createElement('div');
        ph.textContent = 'Run "Compute Layouts" to see the rooting structure';
        ph.style.cssText =
            'flex:1 1 auto; display:flex; align-items:center; justify-content:center; ' +
            'font-size:11px; color:#888; padding:0 6px; text-align:center;';
        bar.appendChild(ph);
        return;
    }

    rootingGroups.forEach((g, idx) => {
        const seg = document.createElement('div');
        seg.className = 'rank-seg';
        seg.style.cssText =
            'flex:' + g.count + ' 1 0; min-width:0; box-sizing:border-box; ' +
            'border-right:' + (idx < rootingGroups.length - 1 ? '1px solid rgba(0,0,0,.35)' : 'none') + '; ' +
            'background:' + blockColor(g.rootBlock) + '; ' +
            'display:flex; flex-direction:column; align-items:center; justify-content:center; ' +
            'cursor:pointer; overflow:hidden; padding:2px 1px; line-height:1.15;';
        seg.title =
            'Rooting ' + (idx + 1) + ': initial block B' + g.rootBlock +
            ' \u2014 ranks ' + (g.start + 1) + '\u2013' + (g.end + 1) + ' (' + g.count + ' layouts)';

        const lbl = document.createElement('div');
        lbl.textContent = 'B' + g.rootBlock;
        lbl.style.cssText = 'font-weight:700; font-size:12px; color:#000; white-space:nowrap;';

        const rng = document.createElement('div');
        rng.textContent = (g.start + 1) + '\u2013' + (g.end + 1);
        rng.style.cssText = 'font-size:10px; color:#000; opacity:.75; white-space:nowrap;';

        seg.appendChild(lbl);
        seg.appendChild(rng);
        seg.addEventListener('click', () => goToLayout(g.start));
        bar.appendChild(seg);
    });
}

/**
 * Move the position marker to the current layout and highlight the current
 * segment. The marker's horizontal position is (currentIndex + 0.5) / N across
 * the whole bar: because each segment's flex weight equals its layout count,
 * one layout maps to one equal slice of the bar width, so this percentage lands
 * exactly on the current layout's slot regardless of segment sizes.
 */
function updateRankMarker() {
    const marker = document.getElementById('rank-marker');
    if (!marker) return;
    const N = rankTotal();
    if (N <= 0 || currentIndex < 0 || rootingGroups.length === 0) {
        marker.style.display = 'none';
    } else {
        marker.style.display = 'block';
        marker.style.left = ((currentIndex + 0.5) / N * 100) + '%';
    }

    const bar = document.getElementById('rank-bar');
    if (bar) {
        const d = (currentIndex >= 0) ? decomposeRank(currentIndex) : null;
        let idx = 0;
        for (const seg of bar.children) {
            if (seg.classList && seg.classList.contains('rank-seg')) {
                seg.style.boxShadow = (d && d.rooting === idx) ? 'inset 0 0 0 2px #111' : 'none';
                idx++;
            }
        }
    }
}

/**
 * Refresh all dynamic parts of the ranking UI: rebuild groups/segments if the
 * dataset changed, update the unrank range hint, the rank readout (both the
 * 0-based rank and the decomposed rooting/perm form plus the 1-based "layout X
 * of Y"), and reposition the marker. Safe to call any time; no-ops if the UI
 * has not been injected yet.
 */
function refreshRankUI() {
    if (!document.getElementById('ranking-controls')) return;

    rebuildRootingGroupsIfNeeded();
    if (rankBarBuiltForLength !== rootingGroupsForLength) {
        renderRankBarSegments();
        rankBarBuiltForLength = rootingGroupsForLength;
    }

    const N = rankTotal();

    const hint = document.getElementById('unrank-hint');
    if (hint) hint.textContent = (N > 0) ? ('1 \u2013 ' + N) : '\u2014';

    const rc = document.getElementById('rank-current');
    const detail = document.getElementById('rank-detail');
    if (rc) {
        if (currentIndex < 0 || N === 0) {
            rc.innerHTML = '&mdash;';
            if (detail) detail.textContent = '';
        } else {
            // Display is 1-based to match the "layout X of Y" navigation bar.
            rc.textContent = 'rank ' + (currentIndex + 1) + ' of ' + N;
            const d = decomposeRank(currentIndex);
            if (detail) {
                detail.textContent = d
                    ? ('initial block B' + d.rootBlock +
                       ' \u00b7 perm ' + (d.perm + 1) + ' of ' + d.count)
                    : '';
            }
        }
    }

    // Enable/disable the inline navigation arrows at the ends.
    const prevBtn = document.getElementById('rank-prev');
    const nextBtn = document.getElementById('rank-next');
    const atStart = !(currentIndex > 0);
    const atEnd = !(currentIndex >= 0 && currentIndex < N - 1);
    if (prevBtn) {
        prevBtn.disabled = atStart;
        prevBtn.style.opacity = atStart ? '0.35' : '1';
        prevBtn.style.cursor = atStart ? 'default' : 'pointer';
    }
    if (nextBtn) {
        nextBtn.disabled = atEnd;
        nextBtn.style.opacity = atEnd ? '0.35' : '1';
        nextBtn.style.cursor = atEnd ? 'default' : 'pointer';
    }

    updateRankMarker();
}

/**
 * Handle a click on "Go" (or Enter in the input): parse the field, validate the
 * resulting rank against the available range, and jump. Errors are shown inline
 * in #unrank-error.
 */
function handleUnrank() {
    const input = document.getElementById('unrank-input');
    const err = document.getElementById('unrank-error');
    if (!input) return;
    const res = parseUnrank(input.value);
    if (!res.ok) { if (err) err.textContent = res.msg; return; }
    const N = rankTotal();
    // Input is 1-based (matches the navigation bar); convert to a 0-based index.
    const idx = res.k - 1;
    if (!(idx >= 0 && idx < N)) {
        if (err) err.textContent = 'Out of range (1\u2013' + N + ')';
        return;
    }
    if (err) err.textContent = '';
    goToLayout(idx);
}

// --- Hook into updateStatistics so the UI refreshes on Run / Next / Prev -----
// updateStatistics() is already called from every navigation path, so wrapping
// it keeps the ranking UI in sync without touching those listeners. The guard
// makes the wrap idempotent (defensive against the patcher double-append issue
// documented in HANDOVER_3).
if (typeof updateStatistics === 'function' && !updateStatistics.__rankWrapped) {
    const _baseUpdateStatistics = updateStatistics;
    updateStatistics = function () {
        _baseUpdateStatistics.apply(this, arguments);
        try { refreshRankUI(); } catch (e) { /* UI not built yet; ignore */ }
    };
    updateStatistics.__rankWrapped = true;
}

// =============================================================================
// FPQ panel auto-sizing
// =============================================================================
//
// The 2x2 grid (#grid in styles.css) uses fixed 420px rows, and .panel has
// overflow:hidden, so a tall FPQ tree would be squashed/zoomed to fit inside
// the fixed cell. To let big trees breathe, we:
//   1. let the bottom grid row grow (grid-template-rows: 420px minmax(420px,
//      auto)) via an injected stylesheet (an id selector overrides styles.css,
//      and the responsive media query is replicated so single-column layout
//      still works);
//   2. set an explicit min-height on the FPQ panel proportional to the tree
//      depth (drawFPQ), clamped between the standard height and a cap;
//   3. refit both bottom networks whenever their panel is resized, via a
//      ResizeObserver, so the BCT panel (which shares the row and therefore the
//      new height) stays visually aligned and both trees re-center smoothly.
// =============================================================================

/**
 * Inject the stylesheet that lets the bottom grid row grow with its content.
 * Idempotent. An id selector overrides the fixed rows declared in styles.css;
 * the max-width:900px media query is replicated so the single-column responsive
 * layout keeps working (with the FPQ row, the 4th one, allowed to grow).
 */
function ensureFPQResizeStyle() {
    if (document.getElementById('fpq-resize-style')) return;
    const st = document.createElement('style');
    st.id = 'fpq-resize-style';
    st.textContent =
        '#grid{grid-template-rows:420px minmax(420px,auto);}' +
        '@media (max-width:900px){#grid{' +
        'grid-template-rows:auto 380px 380px minmax(380px,auto);}}';
    (document.head || document.documentElement).appendChild(st);
}

/**
 * Set the min-height of the FPQ panel (the .panel wrapping #fpq-network). With
 * the growable bottom row this drives how tall the panel — and the shared row —
 * becomes. A CSS transition makes the change smooth; the ResizeObserver refits
 * the networks live during the animation.
 * @param {number} px Target panel min-height in pixels.
 */
function setFPQPanelHeight(px) {
    const c = document.getElementById('fpq-network');
    if (!c || !c.parentElement) return;
    const panel = c.parentElement;
    if (panel.style.transition.indexOf('min-height') === -1) {
        panel.style.transition = 'min-height 0.25s ease';
    }
    panel.style.minHeight = px + 'px';
}

/**
 * Resize a vis Network's canvas to fill its (possibly resized) container and
 * re-fit the graph into view. No-op if the network is null or the call throws.
 * @param {?object} net A vis.Network instance.
 */
function refitNetwork(net) {
    if (!net) return;
    try {
        net.setSize('100%', '100%');
        net.redraw();
        net.fit();
    } catch (e) { /* network destroyed / not ready; ignore */ }
}

/**
 * Observe a network panel (.net container) and refit its current network
 * whenever the container is resized (e.g. when the FPQ panel grows and the
 * shared bottom row changes height). Set up at most once per container; the
 * observer reads the current global network instance each time, so it keeps
 * working across redraws. Falls back to a no-op if ResizeObserver is missing.
 * @param {string} containerId 'bct-network' or 'fpq-network'.
 */
function observeNetPanel(containerId) {
    observeNetPanel._seen = observeNetPanel._seen || {};
    if (observeNetPanel._seen[containerId]) return;
    if (typeof ResizeObserver === 'undefined') { observeNetPanel._seen[containerId] = true; return; }
    const c = document.getElementById(containerId);
    if (!c) return;
    const ro = new ResizeObserver(() => {
        const net = (containerId === 'fpq-network') ? fpqNetwork
                  : (containerId === 'bct-network') ? bctNetwork : null;
        refitNetwork(net);
    });
    ro.observe(c);
    observeNetPanel._seen[containerId] = true;
}

// --- Wiring ------------------------------------------------------------------

(function () {
    function init() {
        ensureControlsPanelStyle();
        ensureFPQResizeStyle();
        ensureRankingControls();
        refreshRankUI();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// =============================================================================
// Auto-compute on upload
// =============================================================================
// Drop the separate "Compute Layouts" step: hide the #run button and run the
// computation as soon as a graph file is chosen, by programmatically clicking
// the (now hidden) #run button, which already holds the full compute + redraw
// logic. JS-only; index.html is left untouched.
// =============================================================================
(function () {
    function hideRunButton() {
        if (document.getElementById('auto-run-style')) return;
        const st = document.createElement('style');
        st.id = 'auto-run-style';
        // !important beats the inline display:block the change-listener sets.
        st.textContent = '#run{display:none !important;}';
        (document.head || document.documentElement).appendChild(st);
    }
    function init() {
        hideRunButton();
        const fileInput = document.getElementById('fileInput');
        const run = document.getElementById('run');
        if (!fileInput || !run) return;
        fileInput.addEventListener('change', function () {
            // Defer so the pre-existing change-listener (#fileName) runs first.
            setTimeout(function () { run.click(); }, 0);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

// =============================================================================
// Task 3: show the failure reason in the 1-stack layout panel
// =============================================================================
// When the DAG admits no 1-stack layout the C++ explains why on stdout (it is
// otherwise only logged). We capture that reason and render it inside #network
// (top-right) instead of leaving the panel blank.
// =============================================================================

var lastLayoutError = null;

/** Map a raw C++ stdout line to a friendly reason, or null if not a known one. */
function matchLayoutError(msg) {
    if (msg.indexOf('not outerplanar') !== -1)
        return 'The graph is not outerplanar, so it admits no 1-page book embedding.';
    if (msg.indexOf('exactly one source and one sink') !== -1)
        return 'A biconnected component does not have exactly one source and one sink.';
    if (msg.indexOf('Hamiltonian path') !== -1)
        return 'A biconnected component has no Hamiltonian path on its outer face.';
    if (msg.indexOf('no admissible root') !== -1)
        return 'No admissible root block exists for this DAG.';
    return null;
}

/** Render an error message inside the #network (1-stack layout) panel. */
function showLayoutErrorOverlay(container, text) {
    container.innerHTML =
        '<div class="placeholder" style="color:#b71c1c; font-weight:600; ' +
        'padding:0 16px; text-align:center; line-height:1.4;">' +
        'No layout could be built.<br>' +
        '<span style="font-weight:400; color:#444;">' + text + '</span></div>';
}

// Capture the reason as the WASM emits it (reset at the start of each run).
if (typeof getDataFromWasm === 'function' && !getDataFromWasm.__errWrapped) {
    const _baseGetData = getDataFromWasm;
    getDataFromWasm = function (message) {
        try {
            if (typeof message === 'string') {
                if (message.indexOf('---- PHASE 1 BEGIN ----') !== -1) lastLayoutError = null;
                const er = matchLayoutError(message);
                if (er) lastLayoutError = er;
            }
        } catch (e) { /* ignore */ }
        return _baseGetData.apply(this, arguments);
    };
    getDataFromWasm.__errWrapped = true;
}

// When an empty layout is drawn, show the captured reason (or a generic one).
if (typeof drawLayout === 'function' && !drawLayout.__errWrapped) {
    const _baseDrawLayoutErr = drawLayout;
    drawLayout = function (g, l) {
        _baseDrawLayoutErr.apply(this, arguments);
        const container = document.getElementById('network');
        if (container && (!l || l.length === 0)) {
            showLayoutErrorOverlay(container,
                lastLayoutError || 'The DAG admits no valid 1-stack layout.');
        }
    };
    drawLayout.__errWrapped = true;
}

// =============================================================================
// Task 4: better use of screen space
// =============================================================================
//   1. Adaptive columns: the left column (Controls + BCT) is kept narrower
//      than the right (1-stack layout + FPQ, which benefit from width); the
//      right side widens further as the graph grows.
//   2. The grid fills the viewport: the TOP row grows to absorb the wasted
//      space; the bottom row stays minmax(420px, auto) so the FPQ auto-sizing
//      keeps working untouched.
// Below 900px the responsive single-column rules take over (inline cleared).
// =============================================================================

var _gridSizingNodes = -2;

function ensureGridGapStyle() {
    if (document.getElementById('grid-gap-style')) return;
    const st = document.createElement('style');
    st.id = 'grid-gap-style';
    st.textContent = '#grid{gap:10px;}';
    (document.head || document.documentElement).appendChild(st);
}

/** Column template for a node count: left 0.40 (small) -> 0.30 (large). */
function adaptiveColumns(nodeCount) {
    const n = Math.max(1, nodeCount | 0);
    let leftFrac = 0.30 - (n - 8) * 0.006;
    leftFrac = Math.max(0.24, Math.min(0.30, leftFrac));
    return (leftFrac * 100).toFixed(1) + '% ' + ((1 - leftFrac) * 100).toFixed(1) + '%';
}

/** Apply adaptive columns + viewport-filling rows (inline beats the stylesheet). */
function applyGridSizing() {
    const grid = document.getElementById('grid');
    if (!grid) return;

    if (window.innerWidth <= 900) {
        grid.style.gridTemplateColumns = '';
        grid.style.gridTemplateRows = '';
    } else {
        // col1 (Controls + BCT) stretta; col2 (FPQ) e col3 (layout) larghe.
        grid.style.gridTemplateColumns = 'minmax(260px, 360px) 1.4fr 1.4fr';

        const gridTop = grid.getBoundingClientRect().top;
        const footer = document.getElementById('footer');
        const footerH = footer ? footer.offsetHeight : 0;
        const margin = 8, gap = 10;
        const gridH = Math.max(520, window.innerHeight - gridTop - footerH - margin);
        const controlsH = 430;                       // riga piccola del Controls (tune)
        const bottomH = gridH - controlsH - gap;
        grid.style.gridTemplateRows = controlsH + 'px ' + bottomH + 'px';
    }

    fitControlsContent();
    try { refitNetwork(typeof bctNetwork !== 'undefined' ? bctNetwork : null); } catch (e) {}
    try { refitNetwork(typeof fpqNetwork !== 'undefined' ? fpqNetwork : null); } catch (e) {}
}

(function () {
    let t = null;
    function onResize() { clearTimeout(t); t = setTimeout(applyGridSizing, 120); }
    function init() {
        ensureGridGapStyle();
        applyGridSizing();
        window.addEventListener('resize', onResize);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // Re-apply columns when the current graph's node count changes.
    if (typeof drawLayout === 'function' && !drawLayout.__gridWrapped) {
        const _baseDrawLayoutGrid = drawLayout;
        drawLayout = function (g, l) {
            _baseDrawLayoutGrid.apply(this, arguments);
            const n = (g && g.nodes) ? g.nodes.length : -1;
            if (n !== _gridSizingNodes && window.innerWidth > 900) applyGridSizing();
        };
        drawLayout.__gridWrapped = true;
    }
})();

// =============================================================================
// Layout polish: full-width grid + Controls panel that never clips (issues 1 & 3)
// =============================================================================
(function () {
    function ensureLayoutPolishStyle() {
        if (document.getElementById('layout-polish-style')) return;
        const st = document.createElement('style');
        st.id = 'layout-polish-style';
        st.textContent =
            '#container{padding:16px 20px;}' +
            '#grid{max-width:none;}' +
            '#buttons{overflow-y:auto; overflow-x:hidden; justify-content:flex-start;}' +
            '#buttons-up, #buttons-down{flex-wrap:nowrap;}' +
            '#ranking-controls, #ranking-controls *{box-sizing:border-box;}' +
            '#ranking-controls input{max-width:100%;}';
        (document.head || document.documentElement).appendChild(st);
        if (typeof applyGridSizing === 'function') setTimeout(applyGridSizing, 0);
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', ensureLayoutPolishStyle);
    else ensureLayoutPolishStyle();
})();

// =============================================================================
// Compact chrome: smaller top nav bar + slimmer footer (less scrolling).
// =============================================================================
(function () {
    function ensureChromeCompactStyle() {
        if (document.getElementById('chrome-compact-style')) return;
        const st = document.createElement('style');
        st.id = 'chrome-compact-style';
         st.textContent =
            'nav{padding:0 22px;}' +
            'nav h1{font-size:1.55rem; padding:0;}' +
            'nav ul li{padding:11px 18px;}' +
            'nav .site-brand img{height:48px !important;}' +
            '#footer{padding:1.2em 0;}';
        (document.head || document.documentElement).appendChild(st);
    }
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', ensureChromeCompactStyle);
    else ensureChromeCompactStyle();
})();

// =============================================================================
// Controls panel: content scales to fit its box (no inner scrollbar).
// =============================================================================
function fitControlsContent() {
    try {
        const panel = document.getElementById('buttons');
        if (!panel) return;
        const title = panel.querySelector('.panel-title');
        let inner = panel.querySelector('#controls-inner');
        if (!inner) {
            inner = document.createElement('div');
            inner.id = 'controls-inner';
            inner.style.transformOrigin = 'top center';
            inner.style.width = '100%';
            panel.appendChild(inner);
        }
        // Pull every content child (not the title, not the wrapper) into inner.
        Array.from(panel.children).forEach(ch => {
            if (ch === title || ch === inner) return;
            inner.appendChild(ch);
        });
        inner.style.transform = 'scale(1)';
        const avail = panel.clientHeight - (title ? title.offsetHeight : 0) - 24;
        const need = inner.scrollHeight;
        const k = (need > avail && need > 0) ? Math.max(0.6, avail / need) : 1;
        inner.style.transform = 'scale(' + k + ')';
    } catch (e) { /* ignore */ }
}

(function () {
    function ensureControlsFitStyle() {
        if (document.getElementById('controls-fit2-style')) return;
        const st = document.createElement('style');
        st.id = 'controls-fit2-style';
        st.textContent =
            '#buttons{overflow:hidden;}' +
            '#buttons .btn-left{padding:8px 12px; font-size:15px; margin-bottom:7px;}' +
            '#ranking-controls{margin-top:8px; padding-top:8px;}';
        (document.head || document.documentElement).appendChild(st);
    }

    // Keep the FPQ panel from growing past its (now fixed) grid cell.
    if (typeof setFPQPanelHeight === 'function' && !setFPQPanelHeight.__neutralized) {
        setFPQPanelHeight = function () {
            const c = document.getElementById('fpq-network');
            if (c && c.parentElement) c.parentElement.style.minHeight = '0px';
        };
        setFPQPanelHeight.__neutralized = true;
    }

    // Re-fit the controls after the rank/segment content changes.
    if (typeof updateStatistics === 'function' && !updateStatistics.__fitWrapped) {
        const _b = updateStatistics;
        updateStatistics = function () { _b.apply(this, arguments); requestAnimationFrame(fitControlsContent); };
        updateStatistics.__fitWrapped = true;
    }

    function init() {
        ensureControlsFitStyle();
        requestAnimationFrame(fitControlsContent);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.addEventListener('resize', function () { requestAnimationFrame(fitControlsContent); });
})();

// =============================================================================
// Three-section layout: [Controls / BCT] | [FPQ] | [vertical 1-stack layout]
// Panels are reordered purely via CSS grid placement (DOM untouched).
// =============================================================================
function ensureThreeSectionStyle() {
    if (document.getElementById('three-section-style')) return;
    const st = document.createElement('style');
    st.id = 'three-section-style';
    st.textContent =
        '#grid > .panel:nth-child(1){grid-column:1;grid-row:1;}' +            // Controls  (top-left)
        '#grid > .panel:nth-child(3){grid-column:1;grid-row:2;}' +            // BCT       (bottom-left)
        '#grid > .panel:nth-child(4){grid-column:2;grid-row:1 / span 2;}' +  // FPQ       (middle, full height)
        '#grid > .panel:nth-child(2){grid-column:3;grid-row:1 / span 2;}' +  // 1-Stack   (right, full height)
        '@media (max-width:900px){#grid > .panel{grid-column:auto !important;grid-row:auto !important;}}';
    (document.head || document.documentElement).appendChild(st);
}
(function () {
    function init() {
        ensureThreeSectionStyle();
        if (typeof applyGridSizing === 'function') applyGridSizing();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

console.log("FRONTEND BUILD: 2026-06-13-1");