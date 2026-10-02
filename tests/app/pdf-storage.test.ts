import test from 'node:test';
import assert from 'node:assert/strict';
import {StorageApiError} from '@supabase/storage-js';
import type {SupabaseClient} from '@supabase/supabase-js';
import {privateStorage} from '../../src/server/pdf/storage';
function fake(error:unknown){return {storage:{from(bucket:string){assert.equal(bucket,'research-originals');return {async upload(_path:string,_bytes:Uint8Array,options:unknown){assert.deepEqual(options,{upsert:false,contentType:'application/pdf',cacheControl:'0'});return {error};},async createSignedUrl(_path:string,seconds:number){assert.equal(seconds,60);return {data:null,error:{message:'refused'}};}};}}} as unknown as SupabaseClient;}
test('Storage adapter recognizes current and legacy duplicate error shapes without upsert',async()=>{for(const error of [new StorageApiError('exists',409,'409'),new StorageApiError('exists',400,'400','storage','Duplicate'),new StorageApiError('exists',409,'409','storage','ResourceAlreadyExists'),new StorageApiError('Asset Already Exists',400,'400'),new StorageApiError('The resource already exists',400,'400')])assert.equal(await privateStorage(fake(error)).putOnce('synthetic/path',new Uint8Array()),'exists');});
test('Storage adapter refuses denied writes and refused signatures',async()=>{const s=privateStorage(fake({statusCode:'403',error:'AccessDenied'}));await assert.rejects(s.putOnce('synthetic/path',new Uint8Array()),/STORAGE/);await assert.rejects(s.sign('synthetic/path',60),/STORAGE/);await assert.rejects(s.readBounded('synthetic/path',1024),/STORAGE/);});

test('arbitrary 400 errors are never accepted as existing objects',async()=>{await assert.rejects(privateStorage(fake(new StorageApiError('bad request',400,'400'))).putOnce('synthetic/path',new Uint8Array()),/STORAGE/);});
