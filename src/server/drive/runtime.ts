import 'server-only';
import {DriveError} from '../../application/drive';
import type {DriveService} from './service';
// Deliberately unconditional: env values cannot enable an unreviewed integration.
export const driveAvailable=false;
export function productionDriveService():DriveService{throw new DriveError('UNCONFIGURED');}

export function productionDriveIntegration():ReturnType<typeof import('./integration').configuredDriveIntegration>{throw new DriveError('UNCONFIGURED');}
