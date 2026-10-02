import 'server-only';
import {z} from 'zod';
import {AppError,uuid,createProjectInput,editProjectInput,createPaperInput,editPaperInput,archiveInput,type Project,type Paper} from '../application/models';
// Injectable only at the server boundary. Production wiring is in dal.ts, never in request input.
export interface ResearchGateway {
 verifiedUser():Promise<{id:string}|null>;
 ownsProject(projectId:string,userId:string):Promise<boolean>;
 listProjects(userId:string):Promise<Project[]>;
 getProject(projectId:string):Promise<Project|null>;
 listPapers(projectId:string):Promise<Paper[]>;
 getPaper(projectId:string,paperId:string):Promise<Paper|null>;
 write(operation:string,args:Record<string,unknown>):Promise<string>;
}
function parse<T>(schema:z.ZodType<T>,input:unknown):T {const result=schema.safeParse(input);if(!result.success)throw new AppError('INVALID');return result.data;}
export class ResearchDAL {
 constructor(private gateway:ResearchGateway){}
 private async user(){const user=await this.gateway.verifiedUser();if(!user)throw new AppError('UNAUTHENTICATED');return user;}
 private async projectScope(projectId:unknown){const id=parse(uuid,projectId);const user=await this.user();if(!await this.gateway.ownsProject(id,user.id))throw new AppError('FORBIDDEN');return id;}
 async projects(){const user=await this.user();return this.gateway.listProjects(user.id);}
 async project(projectId:unknown){const id=await this.projectScope(projectId);const result=await this.gateway.getProject(id);if(!result)throw new AppError('FORBIDDEN');return result;}
 async papers(projectId:unknown){const id=await this.projectScope(projectId);return this.gateway.listPapers(id);}
 async paper(projectId:unknown,paperId:unknown){const pid=await this.projectScope(projectId);const id=parse(uuid,paperId);const result=await this.gateway.getPaper(pid,id);if(!result)throw new AppError('FORBIDDEN');return result;}
 async createProject(raw:unknown){await this.user();const data=parse(createProjectInput,raw);return this.gateway.write('create_project_v2',{p_request_id:data.request_id,p_name:data.name,p_description:data.description});}
 async editProject(raw:unknown){const data=parse(editProjectInput,raw);await this.projectScope(data.project_id);return this.gateway.write('edit_project',{p_project_id:data.project_id,p_revision:data.revision,p_name:data.name,p_description:data.description});}
 async createPaper(raw:unknown){const data=parse(createPaperInput,raw);await this.projectScope(data.project_id);return this.gateway.write('create_paper',{p_project_id:data.project_id,p_request_id:data.request_id,p_title:data.title,p_journal:data.journal,p_year:data.year,p_notes:data.notes,p_doi:data.doi});}
 async editPaper(raw:unknown){const data=parse(editPaperInput,raw);await this.projectScope(data.project_id);return this.gateway.write('edit_paper',{p_project_id:data.project_id,p_paper_id:data.paper_id,p_revision:data.revision,p_title:data.title,p_journal:data.journal,p_year:data.year,p_notes:data.notes});}
 async archive(raw:unknown){const data=parse(archiveInput,raw);await this.projectScope(data.project_id);return this.gateway.write(data.paper_id?'archive_paper':'archive_project',{p_project_id:data.project_id,...(data.paper_id?{p_paper_id:data.paper_id}:{}),p_revision:data.revision,p_archived:data.archived});}
}
