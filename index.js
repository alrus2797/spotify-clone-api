const jsonServer = require('json-server')
const auth = require('json-server-auth')

const SpotifyWebApi = require("spotify-web-api-node");
const dotenv = require("dotenv");

const express = require('express')

const app = jsonServer.create()
const router = jsonServer.router({
  categories: require('./db_files/categories-en.json'),
  sections: require('./db_files/sections.json'),
  users: require('./db_files/users.json'),
  'library-items': [
    {
      "entity": {
        "name": "Liked songs",
        "items": [],
        "type": "ownPlaylist",
        "id": "favorites",
        "image": "https://misc.scdn.co/liked-songs/liked-songs-64.png"
      },
      "userId": 1,
      "id": "favorites-1"
    }
  ]
})

const fetch = require('node-fetch')

app.use(express.json())

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;


let spotifyWebApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
});

spotifyWebApi.clientCredentialsGrant().then((data) => {
  const token = data.body['access_token']
  const type = data.body.token_type
  console.log('Spotify API conected', token, type, data.body)
  spotifyWebApi.setAccessToken(token)
})

setInterval(() => {
  spotifyWebApi.clientCredentialsGrant().then((data) => {
    const token = data.body['access_token']
    const type = data.body.token_type
    console.log('Spotify API reconected', token, type, data.body)
    spotifyWebApi.setAccessToken(token)
  })
}, 3600*60)






const middlewares = jsonServer.defaults();

const port = process.env.PORT || 3000

// /!\ Bind the router db to the app
app.db = router.db

// You must apply the auth middleware before the router
app.use(middlewares)


const search_options =  ['album' , 'artist' , 'playlist' , 'track' , 'show' , 'episode']


app.use('/search/:text', (req, res, next) => {
  console.log('Search middleware for', req.body)
  res.on('finish', () => {
    console.log('Search middleware here for', req.body, req.headers.host)

  })
  next();
})

app.get('/search/:text', (req, res, next) => {
  const {text} = req.params
  const query = req.query
  console.log('queryasds', query)
  console.log('text', text)

  let local_search_options = query.type ? [query.type] : search_options

  console.log(local_search_options);

  spotifyWebApi.search(text, local_search_options, query).then(data => {
    res.send(data.body);
  })
  // return spotifyWebApi.search(query)
})


app.use('/register', (req, res, next) => {
  console.log('Register middleware for', req.body)
  res.on('finish', () => {
    console.log('Register middleware on finish here for', req.body, req.headers.host)

    fetch(`${req.protocol}://${req.headers.host}/users?email=${req.body.email}`).then(data=>data.json()).then(data => {
      if (data.length === 0) throw Error('User was not created for some reason')
      const user = data[0];
      console.log('user', user)

      fetch(`${req.protocol}://${req.headers.host}/library-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': req.headers.authorization
        },
        body: JSON.stringify({
          entity: {
            name: "Liked songs",
            items: [],
            type: "ownPlaylist",
            id: "favorites",
            image: "https://misc.scdn.co/liked-songs/liked-songs-64.png"
          },
          userId: user.id,
          id: `favorites-${user.id}`
        })
      }).then(data => {
        return  data.text()
      }).then(data => {
        console.log('favorites', data)
      }).catch(err => console.log('Error while creating favorites', err))
    })
  })
  next();
})



app.post('/add-to-playlist/:playlistId', (req, res, next) => {

  const {playlistId} = req.params
  console.log('add-to-playlist', req.body, playlistId)

  if (!req.headers.authorization) {
    res.status(401)
    res.json({
      message: 'No token provided',
    })
  } else {
    fetch(`${req.protocol}://${req.headers.host}/library-items?entity.type=ownPlaylist&id=${playlistId}`).then(data=>data.json())
    .then(data => {
      console.log('items', data)
      const items = data[0].entity.items
      const newItems = [...items, req.body]
      console.log('newItems', newItems)
      fetch(`${req.protocol}://${req.headers.host}/library-items/${data[0].id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({entity: {...data[0].entity, items: newItems}})
      }).then(data => data.json()).then(data=>res.json(data))
    }
    ).catch(err => console.log('Error while saving to playlist', err))
  }
})

app.delete('/remove-from-playlist/:playlistId/:itemId', (req, res, next) => {
  const {playlistId, itemId} = req.params
  console.log('remove-from-playlist', req.body, playlistId, itemId)

  if (!req.headers.authorization) {
    res.status(401)
    res.json({
      message: 'No token provided',
    })
  } else {
    fetch(`${req.protocol}://${req.headers.host}/library-items?entity.type=ownPlaylist&id=${playlistId}`).then(data=>data.json())
    .then(data => {
      console.log('items', data)
      const items = data[0].entity.items
      const newItems = items.filter(item => item.id !== itemId)
      console.log('newItems', newItems)
      fetch(`${req.protocol}://${req.headers.host}/library-items/${data[0].id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({entity: {...data[0].entity, items: newItems}})
      }).then(data => data.json()).then(data=>res.json(data))
    }).catch(err => console.log('Error while removing from playlist', err))
  }
})


app.post('/playlist', (req, res, next) => {
  console.log(req.body);
  if (!req.headers.authorization) {
    res.status(401)
    res.json({
      message: 'No token provided'
    })
  }
  // else if (req.body.entity.type === 'ownPlaylist'){
  //   res.status(400)
  //   res.json({
  //     message: 'Entity type must be a ownPlaylist'
  //   })
  // }
  else {
    console.log('host', req.headers.host, req.protocol)
    fetch(`${req.protocol}://${req.headers.host}/library-items?entity.type=ownPlaylist&userId=${req.body.userId}`).then(data=>data.json())
    .then(data => {
      console.log('items', data)
      const id = data.length + 1
      const newOwnPlaylist = {
        entity: {
            name: `New Playlist #${id}`,
            items: [],
            type: "ownPlaylist",
            id
        },
        userId: req.body.userId,
      }

      fetch(`${req.protocol}://${req.headers.host}/library-items`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newOwnPlaylist)
      }).then(data => data.json()).then(data=>res.json(data))
    }).catch(err => console.log(err))
  }
})


// app.use('/register', (req, res, next) => {
//   console.log('A new playlist will be created here for', req.body)
//   res.on('finish', () => {
//     console.log('A new playlist will be created on finish here for', req.body)

//   })
//   next(); 
// })

// app.use('/libray-items', (req, res, next) => {
//   res.on('finish', () => {
//     if (req.method !=='POST') return;
//     fetch(`${req.headers.host}/library-items?userId=${req.body.userId}&`)
//       .then(data => data.json())
//       .then(data => {
//         console.log('parsed data: ', data)
//         fetch(`${req.headers.host}/libraries`, {
//           method: 'POST',
//           body: {
//             userId: data.id,
//             items: []
//           }
//         })
//       })
//   })
//   next()
// })

// app.use(jsonServer.rewriter({
//   '/only-library-items/:userId': '/users/:userId/library-items?entity.id_ne=favorites',
//   })
// )


app.use(auth)



app.use(router)



app.listen(port, () => {
  console.log('App started on', port)
}).on('error', (e) => {
  console.log('LISTENED ERROR: ', e);
})