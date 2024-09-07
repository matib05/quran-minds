"use client"

import { useGlobalContext } from '@/app/Context/store';
import CardWrapper from './card-wrapper'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import { useServerAction } from "zsa-react";
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
import { SurahData } from '@/resources/SurahData'
import { getQuestionsBySurahAction } from '@/app/actions'
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from 'next/navigation'


const FormSchema = z.object({
  fromSurah: z.string({
    required_error: "Please select the beginning portion of your review.",
  }),
  fromAyah: z.string({
    required_error: "Please select the beginning portion of your review.",
  }),
  toSurah: z.string({
    required_error: "Please select the ending portion of your review.",
  }),
  toAyah: z.string({
    required_error: "Please select the ending portion of your review.",
  }),
})

const SurahInputForm = () => {
  const {setFromSurah, setFromAyah, setToSurah, setToAyah, setQuestions } = useGlobalContext();
  const form = useForm({
    resolver: zodResolver(FormSchema),
  });
  let { fromSurah, fromAyah, toSurah, toAyah } = useWatch({control: form.control});
  const { isPending, execute, data, error } = useServerAction(getQuestionsBySurahAction);
  const { toast } = useToast()
  const router = useRouter()

  async function onSubmit(values) {
    console.log(values);
    setFromSurah(fromSurah)
    setFromAyah(fromAyah)
    setToSurah(toSurah)
    setToAyah(toAyah)
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

    setQuestions(data);
    router.push('/review/quiz')
  }

  const buildSurahNameOptions = (isLimited) => {
    let surahIndex;

    if (isLimited) {
      surahIndex = SurahData.findIndex((surah) => {
        return surah[5] === fromSurah;
      })
    }

    return SurahData.map((key, index) => 
      <SelectItem 
        disabled={index < surahIndex}
        value={key[5]}
        key={key}
      >
        {`${index+1} -- ${key[5]} -- ${key[4]}`}
      </SelectItem>
    )
  }
  
  const buildAyahOptions = (fromOrTo) => {
    if (!fromSurah) return [];

    let options = [];
    let surahData = SurahData.filter(surah => (surah[5] === (fromOrTo === 'from' ? fromSurah : toSurah)))[0];

    if (!surahData) return []

    for (let i = 1; i <= surahData[1]; i++) {
      options.push(
      <SelectItem
        disabled={
          (i < fromAyah) && 
          (fromOrTo === 'to') &&
          (fromSurah === toSurah)
        }
        key={i}
        value={i+''}
      >
        {i+''}
      </SelectItem>)
    }

    return options;
  }

  return (
    <CardWrapper
        label='Select beginning surah/ayah and ending surah/ayah'
        title="Select Your Surah's"
        backButtonHref='/review/input/juz'
        backButtonLabel='Review By Juz? Click Here.'
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="fromSurah"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Select Beginning Surah</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a beginning Surah" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                      {buildSurahNameOptions(false)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="fromAyah"
            render={({ field }) => (
              <FormItem>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an Ayah" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                      {buildAyahOptions('from')}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          /> 
          { (form.getValues().fromAyah && form.getValues().fromSurah) ?
            <>
              <FormField
                control={form.control}
                name="toSurah"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Ending Surah</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select ending Surah" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {buildSurahNameOptions(true)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="toAyah"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an Ayah" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                          {buildAyahOptions('to')}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
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

export default SurahInputForm