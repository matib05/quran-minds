import React from 'react'

const ReviewLayout = ({children}) => {
  return (
    <section className='w-full'>
        <div className='flex items-center justify-center'>
            {children}
        </div>
    </section>
  )
}

export default ReviewLayout