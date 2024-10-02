"use client"

import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
} from "@/components/ui/card";
import { useGlobalContext } from "@/app/Context/store";
import AnswerBox from "./answer-box";

const QuestionWrapper = () => {
  let { questions, setQuestionIndex, questionIndex } = useGlobalContext();
  if (!questions) {
    questions = {
      questionType: 'guessWord', 
      question: 'الحمد لله رب العالمين',
      answers: ['1:1'],
      correctAnswer: '1:1'
    }
  }
  const handleNextQuestion = () => {
    setQuestionIndex(questionIndex+1);
  }

  return (
    <Card className="bg-gray-100 rounded-lg shadow-md">
        <CardHeader>
            <div dir="rtl" className='w-full flex flex-col gap-y-4'>
                <h1 className='text-4xl leading-normal uthmani text-center'>
                    {questions[questionIndex]?.question ?? ''}
                </h1>
            </div>
        </CardHeader>
        <CardContent>
          <AnswerBox 
            questionType={questions[questionIndex]?.questionType}
            answers={questions[questionIndex]?.answers}
            correctAnswer={questions[questionIndex]?.correctAnswer}
            nextQuestion={handleNextQuestion}
          />
        </CardContent>
        <CardFooter>
          <p className="mt-4 text-center text-sm text-gray-600">
            Question {questionIndex + 1} of {questions.length}
          </p>
        </CardFooter>
    </Card>
  )
}

export default QuestionWrapper