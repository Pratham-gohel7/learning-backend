import { asyncHandler } from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadToCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefreshTokens = async (userID) => {
    const user = await User.findById(userID)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken, refreshToken}
}

const registerUser = asyncHandler( async (req, res) => {
    const {fullName, email, username, password} = req.body
    console.log(`FullName : ${fullName}`);

    if([fullName, email, username, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({$or: [{username}, {email}]})

    if(existedUser){
        throw new ApiError(409, "User Already exists, Please use different email or username")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    console.log(avatarLocalPath)
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    // console.log(coverImageLocalPath)

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadToCloudinary(avatarLocalPath)
    const coverImage = await uploadToCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar is required...")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    console.log(createdUser);

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while creating user...")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Created successfully....")
    )
})

const loginUser = asyncHandler( async (req, res) => {
    const {email, username, password} = req.body
    console.log(username)
    console.log(email)

    if(!username && !email){
        throw new ApiError(400, "please provide username or email")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User does not exists")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if(!isPasswordCorrect){
        throw new ApiError(403, "Password is incorrect")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedUser, accessToken, refreshToken
            },
            "User Logged In Successfully..."
        )
    )   
})

const logoutUser = asyncHandler( async (req, res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            },
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out Successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised Access Token");
    }

   try {
     const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRECT)
 
     const user = await User.findById(decodedToken?._id)
     if(!user){
         throw new ApiError(401, "Invalid Refresh Token");
     }
 
     if(incomingRefreshToken !== user?.refreshToken){
         throw new ApiError(401, "Refresh token is expired")
     }
 
     const options = {
         httpOnly: true,
         secure: true
     }
 
     const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
     return res.status(201)
     .cookie("accessToken", accessToken, options)
     .cookie("refreshToken", newRefreshToken, options)
     .json(
         new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access Token Refreshed")
     )
   } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
   }
})

const changePassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword, confirmPassword} = req.body
    const user = User.findById(req.user?._id)
    const isCorrectPassword = await user.isPasswordCorrect(oldPassword)

    if(!isCorrectPassword){
        throw new ApiError(400, "Current password is incorrect...")
    }
    if(!(newPassword === confirmPassword)){
        throw new ApiError(400, "new password and confirm password are not same...")
    }

    user.password = newPassword;

    await user.save({validateBeforeSave: false})

    return res.status(200)
    .json(
        new ApiResponse(201, {}, "Password changed successfully...")
    )

})

const currentUser = asyncHandler(async (req, res) => {
    return res.status(200)
    .json(new ApiResponse(201, req.user, "Current user fetched..."))
})

const updateAccount = asyncHandler(async (req, res) => {
    const {fullName, email, username} = req.user;
    
    if(!fullName || !email || !username){
        throw new ApiError(401, "Please provide all the details to update the account....")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                username,
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(201, user, "Account details changed successfully....."))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(401, "Avatar is required...")
    }

    const avatar = await uploadToCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(401, "Error while uploading avatar...")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new : true
        }
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(201, user, "Avatar Updated Successfully..."))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(401, "Cover Image is required...")
    }

    const coverImage = await uploadToCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(401, "Error while uploading Cover Image...")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new : true
        }
    ).select("-password")

    return res.status(200)
    .json(201, user, "Cover Image Updated Successfully...")

})

 const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is Not Provided..")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullName: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }

    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists...")
    }
    // console.log(channel)

    return res.status(200)
                .json(
                    new ApiResponse(201, channel[0], "User channel fetched successfully....")
                )

 })

 const getUserHistory = asyncHandler(async (req, res) => {
    const user = User.aggregate([
        {
            $match: {
                _id: new mongoose.Schema.Types.ObjectId(req.user._id)
            },
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(
        new ApiResponse(201, user[0].watchHistory, "History fetched successfully...")
    )
 })

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    currentUser,
    updateAccount,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserHistory
}
