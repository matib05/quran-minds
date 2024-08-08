const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const readline = require('readline');

const prisma = new PrismaClient();

async function getQuranData() {
    const fileStream = fs.createReadStream('./resources/quran-text.txt', 'utf8');

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let quranDataToSave = [];

    for await (const line of rl) {
        lineSplit = line.split('|');
        quranDataToSave.push({
            juzNumber: parseInt(lineSplit[0]),
            surahName: lineSplit[1],
            surahNumber: parseInt(lineSplit[2]),
            ayahNumber: parseInt(lineSplit[3]),
            ayah: lineSplit[4]
        })
    }

    return quranDataToSave;
}

async function main(quran) {
    console.log(typeof quran);
    const quranData = await prisma.Ayah.createMany({
        data: quran
    });
    
    console.log({ quranData })
};

getQuranData().then(async (data) => {
    main(data).then(async () => {
        await prisma.$disconnect();
    }).catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
})
