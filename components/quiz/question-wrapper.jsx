"use client"

import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
} from "@/components/ui/card";
import { useGlobalContext } from "@/app/Context/store";



const QuestionWrapper = () => {
  let { questions, setQuestionNumber, questionNumber } = useGlobalContext();
  if (!questions) {
    questions = {
      questionType: 'guessWord', 
      question: 'الحمد لله رب العالمين',
      answers: ['1:1'],
      correctAnswer: '1:1'
    }
  }
  return (
    <Card className="shadow-md">
        <CardHeader>
            <div dir="rtl" className='w-full flex flex-col gap-y-4'>
                <h1 className='text-xl leading-normal uthmani text-center'>
                    {questions[questionNumber]?.question ?? ''}
                </h1>
            </div>
        </CardHeader>
        <CardContent>
          {questions[questionNumber]?.questionType ?? ''}
        </CardContent>
        <CardFooter>
          {/*some button */}
        </CardFooter>
    </Card>
  )
}

export default QuestionWrapper