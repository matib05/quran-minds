'use client'

import { useGlobalContext } from "@/app/Context/store";
import QuestionWrapper from "@/components/quiz/question-wrapper";

const QuizPage = () => {
    const { questions, setQuestionNumber, questionNumber } = useGlobalContext();

    let currentQuestion = questions[questionNumber]

    const  { 
        questionType,
        question,
        answers,
        correctAnswer
    } = currentQuestion
    return (
        <QuestionWrapper 
            questionType={questionType}
            question={question}
            questionNumber={questionNumber}
            answers={answers}
            correctAnswer={correctAnswer}
        >
            <div className="grid text-center">
            </div>
        </QuestionWrapper> 
      
    )
  }
  
  export default QuizPage