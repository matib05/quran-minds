import QuestionBox from "@/components/questionBox"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"


const ReviewPage = () => {
  return (
    <div
        className="flex items-center text-center justify-center mt-10 mx-3"
    >
        <Card
            className="flex-initial">
            <CardHeader>
                <CardTitle>
                    <QuestionBox />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>Card Content</p>
            </CardContent>
            <CardFooter>
                <p>Card Footer</p>
            </CardFooter>
        </Card>
    </div>
  )
}

export default ReviewPage