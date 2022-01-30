git pull

chmod 777 start.sh

pm2 delete kana
pm2 start node --name kana -- index


if [ ! -d "./data/" ];then
  mkdir ./data
  chmod 777 ./data
fi

if [ ! -d "./data/db/" ];then
  mkdir ./data/db
  chmod 777 ./data/db
fi

if [ ! -d "./data/file/" ];then
  mkdir ./data/file
  chmod 777 ./data/file
fi
