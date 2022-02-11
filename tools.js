import fs from 'fs'
import path from 'path'

function getStat(path) {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, stats) => {
      err ? resolve(false) : resolve(stats)
    })
  })
}

function mkdir(dir) {
  return new Promise((resolve, reject) => {
    fs.mkdir(dir, err => {
      err ? resolve(false) : resolve(true)
    })
  })
}

async function dirExists(dir) {
  let isExists = await getStat(dir)
  if (isExists && isExists.isDirectory()) {
    return true
  } else if (isExists) {
    return false
  }
  let status = await dirExists(path.parse(dir).dir)
  return status ? await mkdir(dir) : null
}

export default {
  dirExists
}