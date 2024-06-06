const asyncHandler = (requestHandler) => {   //another way
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
        .catch((err) => next(err))
    }
}

//Higher-order function : its a type of function which accepts variable as well as function as a parameter.
// const asyncHandler = (fn) = async (req, res, next) => {   //its a first way of wrapper function
//     try {
//         await fn(req, res, next)
//     } catch (error) {
//         res.status(err.code || 500).json({   // now standardize the error within another file using classes.
//             success: false,
//             message: err.message
//         })
//     }
// }
export default asyncHandler