'use client'

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useFormState } from "react-dom";
import { z } from "zod"

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
import { SurahData } from '@/utils/SurahData'
import { getQuestions } from '@/app/actions'


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

const ReviewInputForm = () => {
  const form = useForm({
    resolver: zodResolver(FormSchema),
  });
  const [state, formAction] = useFormState(getQuestions, {error: null});


  // useEffect(() => {
  //   if (!state) {
  //     return;
  //   }
  
  //   if (state.status === "success") {
  //     alert(state.message);
  //   }
  // }, [state]);
  
  async function onSubmit(values) {
    await getQuestions(values)
  }

  const buildSurahNameOptions = (isLimited) => {
    const surahName = useWatch({name: 'fromSurah'})
    let surahIndex;

    if (isLimited) {
      surahIndex = SurahData.findIndex((surah) => {
        return surah[5] === surahName;
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
    const { fromSurah, fromAyah, toSurah, toAyah } = useWatch([])

    if (!fromSurah) return [];

    let options = [];
    let surahData = SurahData.filter(surah => (surah[5] === fromSurah))[0];

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
                    {buildAyahOptions('from', false)}
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
                        {buildAyahOptions('to', true)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
          : null
        }
        <Button className='mt-3' type="submit">Next</Button>
      </form>
    </Form>
  )
}

export default ReviewInputForm