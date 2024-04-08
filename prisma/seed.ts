// import { prisma } from '../src/database/db'

// async function createGame(){
//   const studio = await prisma.gameStudio.create({
//     data: {
//       studioName: 'FromSoftware',
//       game: {
//         connectOrCreate : {
//           create: {
//             gameName: 'Elden Ring',
            
//           }
//         }
//       }
//     }
//   })
// }


// .then(async () => {
//   await prisma.$disconnect()
// })
// .catch(async e => {
//   console.error(e)
//   await prisma.$disconnect()
//   process.exit(1)
// })