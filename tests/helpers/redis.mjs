// Test-only RESP client. It connects only to an explicitly configured loopback
// Redis fixture; no production credentials or default remote host are accepted.
import { createConnection } from 'node:net';
function parse(buffer, offset=0) {
  if(offset>=buffer.length)return null;
  const end=buffer.indexOf('\r\n',offset);if(end<0)return null;
  const type=String.fromCharCode(buffer[offset]);const value=buffer.toString('utf8',offset+1,end);let next=end+2;
  if(type==='+')return {value,next};
  if(type==='-')return {error:new Error(value),next};
  if(type===':')return {value:Number(value),next};
  if(type==='$'){const size=Number(value);if(size===-1)return {value:null,next};if(buffer.length<next+size+2)return null;return {value:buffer.toString('utf8',next,next+size),next:next+size+2};}
  if(type==='*'){const size=Number(value);if(size===-1)return {value:null,next};const values=[];for(let i=0;i<size;i++){const item=parse(buffer,next);if(!item)return null;if(item.error)return item;values.push(item.value);next=item.next;}return {value:values,next};}
  throw new Error('Unsupported Redis fixture response');
}
function encode(command){return Buffer.concat([Buffer.from(`*${command.length}\r\n`),...command.flatMap(value=>{const bytes=Buffer.from(String(value));return [Buffer.from(`$${bytes.length}\r\n`),bytes,Buffer.from('\r\n')];})]);}
export function testRedis(database=14) {
  const port=Number(process.env.DIGIVATED_TEST_REDIS_PORT);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Set DIGIVATED_TEST_REDIS_PORT to a dedicated local test Redis instance.');
  return command=>new Promise((resolve,reject)=>{
    const socket=createConnection({host:'127.0.0.1',port});let buffer=Buffer.alloc(0),selected=false,finished=false;
    const finish=(error,value)=>{if(finished)return;finished=true;socket.destroy();error?reject(error):resolve(value);};
    socket.setTimeout(5000,()=>finish(new Error('Redis fixture timed out')));socket.on('error',error=>finish(error));
    socket.on('connect',()=>socket.write(Buffer.concat([encode(['SELECT',database]),encode(command)])));
    socket.on('data',data=>{buffer=Buffer.concat([buffer,data]);while(true){const result=parse(buffer);if(!result)return;buffer=buffer.subarray(result.next);if(result.error)return finish(result.error);if(!selected){selected=true;continue;}return finish(null,result.value);}});
  });
}
