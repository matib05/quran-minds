'use client'

import { createContext, useContext, Dispatch, SetStateAction, useState } from "react"

const GlobalContext = createContext({
    fromSurah: '',
    toSurah: '',
    fromAyah: '',
    toAyah: '',
    fromJuz: '',
    toJuz: '',
    questions: [],
})

export const GlobalContextProvider = ({ children }) => {
    const [fromSurah, setFromSurah] = useState();
    const [toSurah, setToSurah] = useState();
    const [fromAyah, setFromAyah] = useState();
    const [toAyah, setToAyah] = useState();
    const [fromJuz, setFromJuz] = useState();
    const [toJuz, setToJuz] = useState();
    const [questions, setQuestions] = useState([]);
    const [questionNumber, setQuestionNumber] = useState();
    const [correct, setCorrect] = useState([]);
    const [incorrect, setIncorrect] = useState([]);

    
    return (
        <GlobalContext.Provider value={{
            fromSurah, setFromSurah,
            toSurah, setToSurah,
            fromAyah, setFromAyah,
            toAyah, setToAyah,
            fromJuz, setFromJuz,
            toJuz, setToJuz,
            questions, setQuestions,
            questionNumber, setQuestionNumber,
            correct, setCorrect,
            incorrect, setIncorrect,
         }}>
            {children}
        </GlobalContext.Provider>
    )
};

export const useGlobalContext = () => useContext(GlobalContext);