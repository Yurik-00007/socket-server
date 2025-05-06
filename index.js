const express = require('express')
const http = require('http')
const {Server} = require('socket.io');
const cors = require('cors')
const app = express()

const route = require('./route')
const {
  addUser,
  findUser,
  getRoomUsers,
  removeUser,
} = require("./users");

app.use(cors({origin: '*'}))
app.use(route)

const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Мониторинг памяти каждые 15 секунд
setInterval(() => {
  const memory = process.memoryUsage().rss / 1024 / 1024;
  console.log(`🧠 Memory used: ${Math.round(memory)} MB`);
}, 15000);

io.on('connect', (socket) => {
  console.log('a user connected');

  socket.on('join', ({name, room}) => {


    socket.join(room); // 1. Присоединяем пользователя к комнате

    const {user, isExist} = addUser({name, room})
    // 2. Добавляем пользователя в список (где-то сохраняем в памяти)


    let userMessage = isExist
      ? `${user.name} here you go again`
      : `Hey my love ${user.name}`


    // 3. Отправляем личное сообщение подключившемуся пользователю
    // Все места в backend, где отправляются данные для useEffect в frontend
    // 1. Приветственное сообщение для нового пользователя
    socket.emit('message', {//socket.emit() (на сервере) — отправка только подключившемуся клиенту
      data: {
        user: {name: 'Admin'},
        message: userMessage
      }
    })
    // 4. Шлём остальным в комнате сообщение, что кто-то вошёл
    //2. Уведомление для всех в комнате о новом пользователе
    socket.broadcast.to(user.room).emit('message', {//socket.broadcast.to(room).emit() — отправка всем кроме отправителя
      data: {
        user: {name: 'Admin'},
        message: `${user.name} has joined`
      }
    })

    io.to(user.room).emit('room', {data: {users: getRoomUsers(user.room)}})
  })

  socket.on('sendMessage', ({message, params}) => {
    if (!params) return;

    const user = findUser(params)
    if (user) {
      //3. Пересылаем сообщение всем в комнате
      io.to(user.room).emit('message', {data: {user, message}})
    }
  })

  socket.on('leftRoom', ({params}) => {
    if (!params) return;

    const user = removeUser(params)
    if (user) {
      const {room, name} = user

      io.to(room).emit('message', {data: {user: {name: 'Admin'}, message: `${name} has left`}})

      io.to(room).emit('room', {data: {users: getRoomUsers(user.room)}})

    }

  })

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
  socket.on('disconnect', () => {
    console.log('user disconnected');

  });


})

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

