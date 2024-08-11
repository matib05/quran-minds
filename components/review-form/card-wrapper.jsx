"use client"

import {
    Card,
    CardContent,
    CardHeader,
    CardFooter,
  } from "@/components/ui/card";
import ReviewHeader from "./review-header";
import BackButton from "./back-button";


const CardWrapper = ({label, title, backButtonHref, backButtonLabel, children}) => {
  return (
    <Card className="shadow-md">
        <CardHeader>
          <ReviewHeader label={label} title={title} />
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
        <CardFooter>
          <BackButton label={backButtonLabel} href={backButtonHref} />
        </CardFooter>
    </Card>
  )
}

export default CardWrapper