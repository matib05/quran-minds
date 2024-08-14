"use client"

import CardWrapper from './card-wrapper'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { useServerAction } from 'zsa-react'
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getQuestionsByJuzAction } from '@/app/actions'
import { useToast } from "@/components/ui/use-toast"

const juzNumbers = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30
]

const FormSchema = z.object({
  fromJuz: z.string({
    required_error: "Please select the beginning portion of your review.",
  }),
  toJuz: z.string({
    required_error: "Please select the ending portion of your review.",
  }),
})

const JuzInputForm = () => {
  const form = useForm({
    resolver: zodResolver(FormSchema),
  });
  let { fromJuz, toJuz } = useWatch({control: form.control});
  const { isPending, execute, data, error } = useServerAction(getQuestionsByJuzAction);
  const { toast } = useToast()
  
  async function onSubmit(values) {
    console.log(values);
    const [data, err] = await execute(values) 
    if (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Uh oh! Something went wrong.",
        description: "There was a problem with your request. Try again later.",
      });
      return
    }

    form.reset()
  }

  const buildJuzNameOptions = (isLimited) => {
    let juzIndex;

    if (isLimited) {
      juzIndex = juzNumbers.findIndex((juz) => {
        return juz === parseInt(fromJuz);
      })
    }

    return juzNumbers.map((juz, index) => 
      <SelectItem 
        disabled={index < juzIndex}
        value={`${juz}`}
        key={juz}
      >
        {`Juz ${juz}`}
      </SelectItem>
    )
  }

  return (
    <CardWrapper
        label='Select beginning juz and ending juz'
        title="Select Your Juz"
        backButtonHref='/review/input/surah'
        backButtonLabel='Review By surah? Click Here.'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="fromJuz"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Beginning Juz</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a beginning Juz" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {buildJuzNameOptions(false)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.getValues().fromJuz ?
            <FormField
                control={form.control}
                name="toJuz"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Select Ending Juz</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger>
                        <SelectValue placeholder="Select an ending Juz" />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {buildJuzNameOptions(true)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            /> 
            : null
          }

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Loading..." : "Next"}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  )
}

export default JuzInputForm