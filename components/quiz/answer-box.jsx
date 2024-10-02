import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { sha3_256 } from 'js-sha3';

const AnswerBox = ({
  questionType = "guessSurah",
  answers = ["London", "Berlin", "Paris", "Madrid"],
  correctAnswer = 'randomString',
  nextQuestion = () => console.log('here'),
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isCheckAnwer, setIsCheckAnwer] = useState(false)

  const handleAnswerClick = (index) => {
    if (!isSubmitted) {
      setSelectedAnswer(index)
    }
  }

  const handleSubmitQuestion = () => {
    //@TODO: save user answer
    setIsSubmitted(true);
    let userAnswer = sha3_256(answers[selectedAnswer])
    if (userAnswer === correctAnswer) {
      setIsCorrectAnswer(true)
    }
    if (userAnswer !== correctAnswer) {
      setIsCorrectAnswer(false)
    }
  }

  const handleNextQuestion = () => {
    setIsSubmitted(false)
    setIsCheckAnwer(false);
    setSelectedAnswer(null);
    nextQuestion();
  }

  const getAnswerStyle = (index) => {
    let userAnswer = sha3_256(answers[index])
    if (!isSubmitted) {
      return selectedAnswer === index ? 'bg-yellow-200' : 'bg-white'
    }
    if (userAnswer === correctAnswer) {
      return 'bg-green-200'
    }
    if (selectedAnswer === index && userAnswer !== correctAnswer) {
      return 'bg-red-200'
    }
    return 'bg-white'
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6">
      {selectedAnswer !== null && !isSubmitted && (
        <p className="mb-4 text-lg font-semibold text-yellow-600 text-center">Final Answer?</p>
      )}
      {isSubmitted && (
        <p className={`mb-4 text-lg font-semibold ${isCorrectAnswer ? 'text-green-400' : 'text-red-400'} text-center`}>
          {isCorrectAnswer ? 'Correct!' : 'Incorrect!'}
        </p>
      )}
      <div className="space-y-4">
        {answers.map((answer, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg cursor-pointer transition-colors duration-200  text-center ${getAnswerStyle(index)}`}
            onClick={() => handleAnswerClick(index)}
          >
            <span className='text-3xl leading-normal uthmani text-center'>{answer}</span>
          </div>
        ))}
      </div>
      {selectedAnswer !== null && (
          <Button
            className="mt-6 w-full"
            onClick={() => handleSubmitQuestion()}
            disabled={selectedAnswer === null}
          >
            Submit
          </Button>
      )}
      {isCheckAnwer && (
        <Button
          className="mt-6 w-full"
          onClick={handleNextQuestion(true)}
        >
          Next
        </Button>
      )}
    </div>
  )
}

export default AnswerBox