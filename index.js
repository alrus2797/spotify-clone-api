const jsonServer = require('json-server')
const auth = require('json-server-auth')

const app = jsonServer.create()
const router = jsonServer.router({
  categories: require('./db_files/categories.json'),
  sections: require('./db_files/sections.json'),
  users: []
})

const middlewares = jsonServer.defaults();

const port = process.env.PORT || 3000

// /!\ Bind the router db to the app
app.db = router.db

// You must apply the auth middleware before the router
app.use(middlewares)
app.use(auth)
app.use(router)
app.listen(port, () => {
  console.log('App started on', port)
})