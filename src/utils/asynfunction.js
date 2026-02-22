const async_function = (funcc) =>{
    (res,req,next)=>{
        Promise.resolve(requestHandler(re,res,next)).catch((error)=> next(error))
    }
}

export {async_function}