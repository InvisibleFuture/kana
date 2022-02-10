import nedb from 'nedb'

const databases = new Map()
const db = (name) => (databases.get(name) || function () {
  let database = new nedb({ filename: `./data/db/${name}.db`, autoload: true, timestampData: true })
  databases.set(name, database)
  return database
}())


export default {
  list: (name, query, callback) => {
    db(name).find(query, callback)
  },
  item: (name) => { },
  user: {},
  account: {
    create: (data) => { },
    delete: (data) => { },
  },
  session: {
    create: (data) => { },
    delete: (data) => { },
  },
  message: {
    create: (data) => { },
    delete: (data) => { },
  },
}
