import React from 'react'
import { Toaster } from "@/components/ui/toaster"
import { GlobalContextProvider } from "@/app/Context/store"

const ReviewLayout = ({children}) => {
  return (
    <GlobalContextProvider>
      <section className='w-full'>
          <div className='flex items-center justify-center'>
              {children}
          </div>
          <Toaster />
      </section>
    </GlobalContextProvider>
  )
}

export default ReviewLayout