import {productionDriveService} from '../../../server/drive/runtime';
import {driveHandler} from '../../../server/drive/orchestration';
// Same dispatcher used in synthetic tests; unconditional production gate remains closed.
export const POST=driveHandler(productionDriveService);
