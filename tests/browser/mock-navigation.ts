const router={push:(destination:string)=>{window.syntheticDestination=destination;},refresh:()=>{window.syntheticRefreshes=(window.syntheticRefreshes??0)+1;}};
export function useRouter(){return router;}
