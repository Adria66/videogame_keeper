//DEPENDENCIES
const chalk      = require('chalk')
const dotenv     = require('dotenv')
const express    = require('express')
const hbs        = require('hbs')
const mongoose   = require('mongoose')
const bodyParser = require('body-parser')
const bcrypt     = require('bcrypt')
const session    = require('express-session')
const MongoStore = require('connect-mongo')(session)

//CONSTANTS
const app = express()

//MODELS
const Videogame = require('./models/Videogame.js')
const User = require('./models/User.js')
const { Router } = require('express')

//CONFIGURATION

//Configuracion de .env
require('dotenv').config()

//Configuracion de mongoose
mongoose.connect(`mongodb://localhost/${process.env.DATABASE}`, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
})
.then((result) => {
    console.log(chalk.cyan(`Connected to Mongo! Database used: ${result.connections[0].name}`));
})
.catch((error) => {
    console.log(chalk.red(`There has been an error: ${error}`));
});

//Configuracion de hbs
app.set('view engine', 'hbs')
app.set('views', __dirname + '/views')
hbs.registerPartials(__dirname + '/views/partials')


//Configuracion del body parser
app.use(bodyParser.urlencoded({ extended: true }));

//Configuracion carpeta estatica
app.use(express.static(__dirname + '/public'))

//Configuracion de cookies
app.use(session({
    secret: "basic-auth-secret",
    // cookie: { maxAge: 60000 },
    saveUninitialized: true,
    resave: true,
    store: new MongoStore({
      mongooseConnection: mongoose.connection,
      ttl: 24 * 60 * 60 // 1 day
    })
  }));

//ROUTES

//Ruta get de la home page
app.get('/', (req, res, next)=>{
    res.render('home', {session: req.session.currentUser})
})


app.get('/log-in', (req, res, next)=>{
    res.render('logIn')
})

app.post('/log-in', (req, res, next)=>{
    const {email, password} = req.body

    User.findOne({email: email})
    .then((result)=>{
        if(!result){
            res.render('logIn', {errorMessage: 'Este usuario no existe. Lo sentimos.'})
        } else {
            bcrypt.compare(password, result.password)
            .then((resultFromBcrypt)=>{
                if(resultFromBcrypt){
                    req.session.currentUser = email
                    console.log(req.session)
                    res.redirect('/')
                } else {
                    res.render('logIn', {errorMessage: 'Contraseña incorrecta. Por favor, vuelva a intentarlo.'})
                }
            })
        }
    })
})

app.get('/sign-up', (req, res, next)=>{
    res.render('signUp')
})

app.post('/sign-up', (req, res, next)=>{
    const {email, password} = req.body
    User.findOne({email: email})
    .then((result)=>{
      if(!result){
        bcrypt.genSalt(10)
        .then((salt)=>{
          bcrypt.hash(password, salt)
          .then((hashedPassword)=>{
            const hashedUser = {email: email, password: hashedPassword}
            User.create(hashedUser)
            .then((result)=>{
              res.redirect('/')
            })
          })
        })
        .catch((err)=>{
          res.send(err)
        })
      } else {
        res.render('logIn', {errorMessage: 'Este usuario ya existe. ¿Querías hacer Log In?'})
      }
    })
  })

app.use((req, res, next)=>{
    if (req.session.currentUser) {
        next();
    } else {
        res.redirect('/log-in');
    }
})

//Ruta get para renderizar el formulario de creacion de un videojuego
app.get('/new-videogame', (req, res, next)=>{
    res.render('newVideogame')  
})

//Ruga post para crear un nuevo videojuego
app.post('/new-videogame', (req, res, next)=>{

    const splitString = (_string) =>{
        const genreString = _string
        const splittedGenreString = genreString.split(',')
        return splittedGenreString   
    }
    
    const arrayPlatform = splitString(req.body.platform)
    const arrayGenre = splitString(req.body.genre)

    const newVideogame = {...req.body, genre: arrayGenre, platform: arrayPlatform}

    Videogame.create(newVideogame)
    .then((createdVideogame)=>{
        console.log(createdVideogame)
        User.updateOne({email: req.session.currentUser}, {$push: {videogames: createdVideogame._id}})
        .then((result)=>{
            console.log(result)
        })
        res.redirect('/all-videogames')
    })
    .catch((err)=>console.log(err))
})

//Ruta get para ver la pargina personalizada de un videojuego
app.get('/videogame/:id', (req, res, next)=>{
    const videogameID = req.params.id
    
    Videogame.findById(videogameID)
    .then((result)=>{
        res.render('singleVideogame', result)
    })
    .catch((err)=>{
        console.log(err)
        res.send(err)
    })
})

//Ruta get para ver todos mis mideojuegos
app.get('/all-videogames', (req, res, next)=>{
    // Videogame.find({}, {name: 1, _id: 1, imageUrl: 1})
    //     .then((videogames)=>{
    //         res.render('allVideogames', {videogames})
    //     })
    //     .catch(()=>{
    //         console.log(err)
    //         res.send(err)
    //     })

    User.findOne({email: req.session.currentUser})
    .populate('videogames')
    .then((user)=>{
        const videogames = user.videogames
        res.render('allVideogames', {videogames: videogames})
    })
    .catch(()=>{
        console.log(err)
        res.send(err)
    })
})

//Ruta post para eliminar un videojuego
app.post('/delete-game/:id', (req, res, next)=>{

    const id = req.params.id

    Videogame.findByIdAndDelete(id)
    .then(()=>{
        res.redirect('/all-videogames')
    })
    .catch(()=>{
        console.log(err)
        res.send(err)
    })
})

//Ruta GET para ver el formulario de edicion de un videojuego especifico
app.get('/edit-videogame/:id', (req, res, next)=>{
    const _id = req.params.id
    Videogame.findById(_id)
    .then((result)=>{
        res.render('editForm', result)
    })
    .catch(()=>{
        console.log(err)
        res.send(error)
    })
})

//Ruta POST para editar un videojuego especifico
app.post('/edit-videogame/:id', (req, res, next)=>{

    const _id = req.params.id
    const editedVideogame = req.body

    Videogame.findByIdAndUpdate(_id, editedVideogame)
    .then(()=>{
        res.redirect(`/videogame/${_id}`)
    })
    .catch(()=>{
        console.log(err)
        res.send(err)
    })
})

app.get('/log-out', (req, res, next)=>{
    req.session.destroy()
    res.redirect('/')
})



//LISTENER
app.listen(process.env.PORT, ()=>{
    console.log(chalk.blue.inverse.bold(`Conectado al puerto ${process.env.PORT}`))
})
