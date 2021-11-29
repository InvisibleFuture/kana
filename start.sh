git pull

chmod 777 start.sh

pm2 delete kana
pm2 start node --name kana -- index
