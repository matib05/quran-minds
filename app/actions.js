'use server'
import prisma from '@/lib/prisma';
import { SurahData } from '@/resources/SurahData';



export async function getQuestionsBySurah(formData) {
    const { fromSurah, fromAyah, toSurah, toAyah } = formData;
    let fromSurahNumber = convertSurahNametoNumber(fromSurah)
    let toSurahNumber = convertSurahNametoNumber(toSurah)

    console.log(fromSurahNumber, toSurahNumber)
    let ayaat;
    try {
        ayaat = await prisma.ayah.findMany({
            where: {
                AND: [
                    {
                        surahNumber: {
                            gte: fromSurahNumber
                        }
                    },
                    {
                        surahNumber: {
                            lte: toSurahNumber
                        }
                    },
                    {
                        AND: [
                            {
                                surahNumber: {
                                    equals: fromSurahNumber
                                },
                            },
                            {
                                ayahNumber: {
                                    gte: parseInt(fromAyah)
                                }
                            }
                        ]   
                    },
                    {
                        AND: [
                            {
                                surahNumber: {
                                    equals: fromSurahNumber
                                },
                            },
                            {
                                ayahNumber: {
                                    lte: parseInt(toAyah)
                                }
                            }
                        ]   
                    }
                ]
            }
        })

    } catch (error) {
        console.error(error)
    }
    console.log(ayaat);
    return {error: false};
}

export async function getQuestionsByJuz(formData) {
    const { fromJuz, toJuz } = formData;

    let ayaat;
    try {
        ayaat = await prisma.ayah.findMany({
            where: {
                AND: [
                    { juzNumber: { gte: parseInt(toJuz) }},
                    { juzNumber: { lte: parseInt(fromJuz) }},
                ]
            }
        })

    } catch (error) {
        console.error(error)
    }
    console.log(ayaat);
    return {error: false};
}

const convertSurahNametoNumber = (surahName) => {
    return SurahData.filter(surah => surahName === surah[5])[0][8]
}