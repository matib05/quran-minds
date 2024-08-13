import React from 'react'
import { Toaster } from "@/components/ui/toaster"


const ReviewLayout = ({children}) => {
  return (
    <section className='w-full'>
        <div className='flex items-center justify-center'>
            {children}
        </div>
        <Toaster />
    </section>
  )
}

export default ReviewLayout