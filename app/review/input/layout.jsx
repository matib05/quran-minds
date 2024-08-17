import { GlobalContextProvider } from "@/app/Context/store"

const ReviewInputLayout = ({children}) => {
  return (
    <div
      className='w-full lg:w-1/3 md:w-1/2 mt-10 mx-3'
    >
      <GlobalContextProvider>
        {children}
      </GlobalContextProvider>
    </div>
  )
}

export default ReviewInputLayout