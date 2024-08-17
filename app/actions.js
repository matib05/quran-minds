'use server'

import prisma from '@/lib/prisma';
import { SurahData } from '@/resources/SurahData';
import { createServerAction } from "zsa"
import z from 'zod';
import { randoSequence} from '@nastyox/rando.js';
import { sha3_256 } from 'js-sha3';


export const getQuestionsBySurahAction = createServerAction()
    .input(
        z.object({
            fromSurah: z.string({
              required_error: "Please select the beginning portion of your review.",
            }),
            fromAyah: z.string({
              required_error: "Please select the beginning portion of your review.",
            }),
            toSurah: z.string({
              required_error: "Please select the ending portion of your review.",
            }),
            toAyah: z.string({
              required_error: "Please select the ending portion of your review.",
            }),
        }),
    )
    .handler(async ({ input: { fromSurah, fromAyah, toSurah, toAyah } }) => {
        let fromSurahNumber = SurahData.filter(surah => fromSurah === surah[5])[0][8]
        let toSurahNumber = SurahData.filter(surah => toSurah === surah[5])[0][8]
        let ayaatFromDB;
        try {
            ayaatFromDB = await prisma.ayah.findMany({
                where: {
                    AND: [
                        { surahNumber: { gte: fromSurahNumber } },
                        { surahNumber: { lte: toSurahNumber } },
                    ]
                }
            })
    
        } catch (error) {
            throw new Error(error)
        }

        //@TODO: figire out a way to add this filter into the db query
        const filteredAyaat = ayaatFromDB.filter(ayah => {
            if (ayah.surahNumber === fromSurahNumber) {
                return ayah.ayahNumber >= parseInt(fromAyah)
            }
            else if (ayah.surahNumber === toSurahNumber) {
                return ayah.ayahNumber <= parseInt(toAyah);
            }
            if (ayah.surahNumber !== fromSurahNumber || ayah.surahNumber !== toSurahNumber) {
                return ayah;
            }
        })

        if (!filteredAyaat.length) throw new Error('Ayaat not found');

        return appendQuestionData(filteredAyaat);
    })

export async function getQuestionsByJuzAction(formData) {
    const { fromJuz, toJuz } = formData;

    let ayaat;
    try {
        ayaat = await prisma.ayah.findMany({
            where: {
                AND: [
                    { juzNumber: { gte: parseInt(fromJuz) }},
                    { juzNumber: { lte: parseInt(toJuz) }},
                ]
            }
        })
    } catch (error) {
        console.error(error)
    }
    return appendQuestionData(ayaat)
}

const appendQuestionData = (ayaat) => {
    const randomAyat = randoSequence(ayaat).slice(0, (ayaat.length > 10) ? 10 : ayaat.length-1);

    //@TODO: add other question types: rando('guessSurah', 'fillInBlank', 'matchWords', 'guessBeforeAfter'),
    const questionType = 'guessSurah';

    const data = randomAyat.map(({index, value}) => {
        return {
            questionType,
            question: value.ayah,
            answers: generateAnswers(questionType, value.surahNumber),
            correctAnswer: sha3_256(SurahData[value.surahNumber-1][5]),
        }
    })
    return data;
}
const generateAnswers = (questionType, correctAnswer) => {
    switch (questionType) {
        case 'guessSurah':
            let surahDataWithoutCorrectAnswer = SurahData.slice(0, correctAnswer-1).concat(SurahData.slice(correctAnswer));
            let answers = randoSequence(surahDataWithoutCorrectAnswer).map(answer => answer.value);
            answers = answers.slice(0,3);
            answers.push(SurahData[correctAnswer-1])
            let randomizedAnswers = randoSequence(answers)
            return randomizedAnswers.map(surahData => {
                //@TODO: generate arabic surah names, not english transliterations
                return surahData.value[4] 
            });
    }
}