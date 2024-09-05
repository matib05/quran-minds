"use client"

import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
  } from "@/components/ui/card";


const QuestionWrapper = ({
    question,
    questionType,
    answers,
    correctAnswer
}) => {
  return (
    <Card className="shadow-md">
        <CardHeader>
            <div dir="rtl" className='w-full flex flex-col gap-y-4'>
                <h1 className='text-xl uthmani text-center'>
                    {question}
                </h1>
            </div>
        </CardHeader>
        <CardContent>
          {questionType}
        </CardContent>
        <CardFooter>
          {/*some button */}
        </CardFooter>
    </Card>
  )
}

export default QuestionWrapper