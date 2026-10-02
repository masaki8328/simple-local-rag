import 'server-only';
import {DriveError} from '../../application/drive';
import type {DriveService} from './service';
import {configuredDriveIntegration} from './integration';
import {driveEnvironment} from './environment';
import {userClient} from '../supabase/client';
// No network, pool acquisition or credential provisioning during availability checks.
export function createDriveRuntime(env:Record<string,string|undefined>,compose:typeof configuredDriveIntegration=configuredDriveIntegration){
 const config=driveEnvironment(env);let integration:ReturnType<typeof configuredDriveIntegration>|undefined;
 return {available:config!==null,integration(){if(!config)throw new DriveError('UNCONFIGURED');return integration??=compose({...config,userClient});}};
}
const runtime=createDriveRuntime(process.env);
export const driveAvailable=runtime.available;
export function productionDriveIntegration(){return runtime.integration();}
// The legacy unscoped service accessor stays closed. Routes use request-bound integration.
export function productionDriveService():DriveService{throw new DriveError('UNCONFIGURED');}
