const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User.js');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');


require('dotenv').config()
const app = express();
 

const bcryptSalt = bcrypt.genSaltSync(10);
// const JWT_SECRET = 'dhshdnvbfhrtyghfjdksiutbnvjghu';

//MIDDLEWARES
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname+'/uploads'));
app.use(cors());

router.get("/", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "https://houseapp.onrender.com")
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "1800");
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader( "Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, PATCH, OPTIONS" ); 
     });

mongoose.connect(process.env.MONGO_URL);



// FUNCTION FOR VERIFYING A USER'S TOKEN 

function getUserDataFromReq(req) {
    return new Promise((resolve,reject) => {
        jwt.verify(req.cookies.token, process.env.JWT_SECRET, {}, async (err, userData) => {
            if (err) throw err;
            resolve (userData);
        });
    });
}
 

app.get('/test', (req,res) => {
    res.json('test ok');
});


//FOR REGISTERING A USER

app.post('/register', async (req,res) => {
    const {name,email,password} = req.body;

    try {
        const userDoc = await User.create({
            name,
            email,
            password:bcrypt.hashSync(password, bcryptSalt),
            });

            res.json(userDoc);

    } catch (e) {
        res.status(422).json(e);
    }
});

//FOR LOGIN IN A USER

app.post ('/login', async (req,res) => {
    const {email,password} = req.body;
    const userDoc = await User.findOne({email});

    if (userDoc) {
        const passOk = bcrypt.compareSync(password, userDoc.password);
        if (passOk) {
            jwt.sign({email:userDoc.email, id:userDoc._id}, process.env.JWT_SECRET, {}, (err, token) => {
                if (err) throw err;
                res.cookie('token', token).json(userDoc);
            });
            
        } else {
            res.status(422).json ('password incorrect');
        }
    } else {
        res.json('not found');
    }
});


//TO GET PROFILE OF LOGGED IN USER

app.get('/profile', (req,res) => {
    const {token} = req.cookies;
    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, {}, async (err, userData) => {
            if (err) throw err;
            const {name,email,_id} = await User.findById(userData.id);
            res.json({name,email,_id});
        });
    } else {
        res.json(null);
    }
});



//TO LOG A USER OUT FROM ACCOUNT PAGE

app.post('/logout', (req,res) => {
    res.cookie('token', '').json(true);
});



//UPLOADING PHOTOS VIA LINK
app.post('/upload-by-link', async (req,res) => {
    const {link} = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    await imageDownloader.image({
        url: link,
        dest: __dirname + '/uploads/'+newName,
    });
        res.json(newName);
})

//upload photos via upload button

const photosMiddleware = multer({dest:'uploads/'});
app.post('/upload', photosMiddleware.array('photos', 100), (req,res) => {
    const uploadedFiles = [];
    for(let i = 0; i < req.files.length; i++) {
        const {path,originalname} = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('uploads\\', ''));
    }
    res.json(uploadedFiles);
})


//TO CREATE A NEW PLACE

app.post('/places', (req,res) => {
    const {token} = req.cookies;

    const {
        title,address,addedPhotos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price
    } = req.body;

    jwt.verify(token, process.env.JWT_SECRET, {}, async (err, userData) => {
        if (err) throw err;
    const placeDoc = await Place.create({
        owner:userData.id,
        title,address,photos:addedPhotos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price
    });
        res.json(placeDoc);
});
});


//TO GET PLACES CREATED BY A PARTICULAR USER

app.get('/user-places', (req,res) => {
    const {token} = req.cookies;  
    jwt.verify(token, process.env.JWT_SECRET, {}, async (err, userData) => {
        const {id} = userData;
        res.json( await Place.find({owner:id}) );
    });
})


// THIS IS TO ENABLE PRINT OUT OF ORIGINAL DETAILS OF A PLACE.

app.get('/places/:id', async (req,res) => {
    const {id} = req.params;
    res.json(await Place.findById(id) )
})

//THIS IS TO ENABLE EDIT FUNCTIONALITY FOR A USER TO BE ABLE TO EDIT THE PLACES THEY ADDED AND SAVE IT

app.put('/places/', async (req,res) => {
    const {token} = req.cookies;

    const {
        id, title,address,addedPhotos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price
    } = req.body;
    jwt.verify(token, process.env.JWT_SECRET, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title,address,photos:addedPhotos,description,
                perks,extraInfo,checkIn,checkOut,maxGuests,price
            });
            await placeDoc.save();
            res.json('ok')
        }
    });

});


// THIS IS TO ENABLE THE PRINT OUT OF ALL THE REGISTERED PLACES ON THIS PLATFORM ON INDEX/HOME PAGE

app.get('/places', async (req,res) => {
    res.json(await Place.find());
});


//FOR BOOKING FUNCTIONALITY CREATION FOR WHEN A USER MAKES A BOOKING

app.post('/bookings', async (req,res) => {
    const userData = await getUserDataFromReq(req)
    const {place,checkIn,checkOut,numberOfGuests,name,phone,price,} = req.body;
   Booking.create({
        place,checkIn,checkOut,numberOfGuests,name,phone,price,
        user:userData.id,
    }).then((doc) => {
        res.json(doc);
    }).catch((err) => {
        throw err;
    });
});


app.get('/bookings', async (req,res) => {
   const userData = await getUserDataFromReq(req);
   res.json( await Booking.find({user:userData.id}).populate('place') );
});

app.listen(process.env.PORT);