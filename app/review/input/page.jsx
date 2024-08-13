import CardWrapper from "@/components/review-form/card-wrapper";
import Link from "next/link";

const ReviewInputPage = () => {
    return (
        <CardWrapper 
            title='How would you like to review'
            label=''
            backButtonHref='/'
            backButtonLabel='Go Back'
        >
            <div className="grid text-center">
                <Link
                    href="/review/input/juz"
                    className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-red-50 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
                >
                    <h2 className={`mb-3 text-2xl font-semibold`}>
                        Review By Selecting Juz
                    </h2>
                </Link>
        
                <Link
                    href="/review/input/surah"
                    className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-red-50 hover:dark:border-neutral-700 hover:dark:bg-neutral-800 hover:dark:bg-opacity-30"
                    >
                    <h2 className={`mb-3 text-2xl font-semibold`}>
                        Review By Selecting Surah
                    </h2>
                </Link>
            </div>
        </CardWrapper>
      
    )
  }
  
  export default ReviewInputPage