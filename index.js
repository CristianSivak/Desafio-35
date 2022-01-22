const express = require('express');
const expressSession = require('express-session');
const cookieParser = require('cookie-parser');
const handlebars = require('express-handlebars');
const cluster = require('cluster');
const mongoose = require('mongoose');
const TwitterStrategy = require('passport-twitter').Strategy;
const compression = require('compression');
const log4js = require('log4js');
const nodemailer = require("nodemailer");


/* -------------- EMAIL & SMS -------------- */

// ethereal

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
    user: 'tristian.mante60@ethereal.email',
    pass: 'T3cevdSnQGFaFsUMj3'
  }
});

const enviarEthereal = (asunto, mensaje) => {
  const mailOptions ={
      from: 'Servidor Node.js',
      to: 'tristian.mante60@ethereal.email',
      subject: asunto,
      html: mensaje
  }

  transporter.sendMail(mailOptions, (err, info) => {
      if(err) {
          console.log(err);
      }
      else console.log(info);
  })
}

// ------- 
//gmail

const transporterG = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: 'codersivak@gmail.com',
      pass: 'martesyjueves'
  }
});

const enviarGmail = (asunto, mensaje, adjunto, to) => {
  const mailOptions ={
      from: 'Servidor Node.js',
      to: to,
      subject: asunto,
      html: mensaje, 
      attachments: [
          {
              path: adjunto,
              filename: 'profile.jpg',
          }
      ]
  }

  transporterG.sendMail(mailOptions, (err, info) => {
      if(err) {
          console.log(err);
      }
      else console.log(info);
  })
}

// ------- 
// twilio

const accountSid = 'ACc8825e55199ff5a04ca0f41b7ffe3cdd';
const authToken = 'fdccfcba15291733d3558f99ecff3a31';

const twilio = require('twilio');

const client = twilio(accountSid, authToken);

const enviarSMS = (mensaje) => { 
  let rta = client.messages.create({
          body: mensaje, 
          from: '+16077032988',
          to: '+5491153754381'
  })
  return rta;   
}



/////////////////*LOG4JS*////////////////////////
log4js.configure({
  appenders: {
      miLoggerConsole: {type: "console"},
      miLoggerFileWarning: {type: 'file', filename: 'warn.log'},
      miLoggerFileError: {type: 'file', filename: 'error.log'}
  },
  categories: {
      default: {appenders: ["miLoggerConsole"], level:"trace"},
      info: {appenders: ["miLoggerConsole"], level: "info"},
      warn: {appenders:["miLoggerFileWarning"], level: "warn"},
      error: {appenders: ["miLoggerFileError"], level: "error"}
  }
});

const loggerInfo = log4js.getLogger('info');
const loggerWarn = log4js.getLogger('warn');
const loggerError = log4js.getLogger('error');

/////////////////*PASSPORT*//////////////////////// 

const passport = require('passport');

// TEST APP
const portCL = process.argv[2] || 5504;
const TWITTER_CLIENT_ID = process.argv[3] || 'fX8rSWtkYfLQyRcLNzk08sEzv';
const TWITTER_CLIENT_SECRET = process.argv[4] || 'qZP9sNi4lUM8LOOR0mpfbVXutJD6qHz7ckq7szujDnjI7l9T7n';
const modoCluster = process.argv[5] == 'CLUSTER'

///////////////*Login con Twitter*////////////////////

/* MASTER */

if(modoCluster && cluster.isMaster) {
  // if Master, crea workers

  console.log(`Master ${process.pid} is running`);

  // fork workers
  for (let i=0; i<numCPUs; i++){
      cluster.fork()
  };

  cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  // if !Master, alta al servidor + resto funcionalidades

  passport.use(
    new TwitterStrategy(
      {
        consumerKey: TWITTER_CLIENT_ID,
        consumerSecret: TWITTER_CLIENT_SECRET,
        callbackURL: '/auth/twitter/callback',
      },
      (_token, _tokenSecret, profile, done) => {
        console.log(profile);
  
        return done(null,profile,);
      }));


passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

//////////////////////////////////////

const app = express();

//////////////////////////////////////////////////

app.set("views", "./views");
app.set("view engine", "ejs");

/////////////////////////////////////

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use(
  expressSession({
    secret: 'keyboard cat',
    cookie: {
      httpOnly: false,
      secure: false,
      maxAge: 60 * 10 * 1000,
    },
    rolling: true,
    resave: true,
    saveUninitialized: false,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

/////////////////*COMPRESSION*//////////////////////// 

app.use(compression());

//////////////////////////////////////

const loginStrategyName = 'login';
const signUpStrategyName = 'signup';


/* Loguear usuario  */

app.get('/', (_request, response) => response.render(`pages/index`));

app.get('/faillogin', (_request, response) => response.render(`pages/faillogin`));

app.get('/main', (request, response) => {
  let usuario = request.user;
  response.render(`pages/main`, {user: usuario})

  let nombre = request.user.displayName;
  let foto = request.user.photos[0].value;
  let email = "cristian.svk@gmail.com";

  let date = new Date().toLocaleString();

  let asunto = 'Logged in';
  let mensaje = `El usuario ${nombre} inició sesión el día ${date}`;


  // ethereal 
  enviarEthereal(asunto, mensaje);
  // gmail
  enviarGmail(asunto, mensaje, foto, email);
}
  );

app.get('/auth/twitter',passport.authenticate('twitter'),);

app.get(
  '/auth/twitter/callback',
  passport.authenticate(
    'twitter',
    {
      successRedirect: '/main',
      failureRedirect: '/faillogin',
    },
  ),
);

app.get('/enviarSMS', (request, response) => {
  let date = new Date().toLocaleString();
  let mensaje = `Están intentando iniciar sesión el día ${date}`;

  let rta = enviarSMS(mensaje);
  response.send(rta);
})

/* Registrar usuario */

app.get('/signup', 
  (_request, response) => response.render(`pages/signup`));

app.post(
  '/signup',
  passport.authenticate(signUpStrategyName, { failureRedirect: '/failsignup' }),
  (_request, response) => response.render(`pages/index`),
);

app.get('/failsignup', (_request, response) => response.render(`pages/failsignup`));

/* Deslogueo */

app.get('/logout', (request, response) => {
  const {user} = request.query;  
  
        let nombre = request.user.displayName;
        let date = new Date().toLocaleString();

        // ethereal

        let asunto = 'Logged out';
        let mensaje = `El usuario ${nombre} cerró sesión el día ${date}`;

        enviarEthereal(asunto, mensaje);

        request.logout();
  
  return response.status(200).render(`pages/logout`, {user: user})
});

/* -------------- GLOBAL PROCESS & CHILD PROCESS -------------- */

// PROCESS
app.get('/info', (request, response) => {

  let info = {
    rgEntrada: JSON.stringify(process.argv, null, '\t'), 
    os: process.platform, 
    nodeVs: process.version, 
    memoryUsage: JSON.stringify(process.memoryUsage()), 
    excPath: process.execPath, 
    processID: process.pid, 
    folder: process.cwd(),
    numCPUs
};

// test
//console.log(info);

  response.render("info", info);


});

// CHILD PROCESS
const {fork} = require('child_process');

// /randoms?cant=20000
app.get('/randoms', (request, response) => {
  try{
   const randomNumber = fork('./child.js');
   
   randomNumber.send(request.query);
   randomNumber.on('message', numerosRandom => {
       response.end(`Numeros random ${JSON.stringify(numerosRandom)}`);
   });
 } catch (err) {
   loggerError.error(err);
 }
});

//////////////////////////////////////////////////////

app.listen( process.env.PORT|| portCL, ()=>{
  loggerInfo.info(`Running on PORT ${portCL} - PID WORKER ${process.pid}`);
  mongoose.connect('mongodb://localhost:27017/ecommerce', 
      {
          useNewUrlParser: true, 
          useUnifiedTopology: true
      }
  )
      .then( () => loggerInfo.info('Base de datos conectada') )
      .catch( (err) => loggerError.error(err) );
})

loggerInfo.info(`Worker ${process.pid} started`);
};
