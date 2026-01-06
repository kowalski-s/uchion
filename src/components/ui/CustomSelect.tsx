import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'

export type SelectOption = {
  label: string
  value: string | number
}

type CustomSelectProps = {
  label: string
  value: string | number
  onChange: (value: string | number) => void
  options: SelectOption[]
}

export default function CustomSelect({ label, value, onChange, options }: CustomSelectProps) {
  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className="w-full">
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button className="relative h-14 w-full cursor-default rounded-xl border border-slate-200 bg-white py-2 pl-5 pr-10 text-left shadow-sm transition-all focus:border-[#8C52FF] focus:outline-none focus:ring-2 focus:ring-[#8C52FF]/20 hover:border-[#8C52FF] hover:ring-2 hover:ring-[#8C52FF]/10">
            <span className="flex flex-col items-start">
              <span className="text-[11px] font-medium leading-4 text-slate-400 uppercase tracking-wide">
                {label}
              </span>
              <span className="block truncate text-base font-medium text-slate-900 mt-0.5">
                {selectedOption?.label || 'Выберите...'}
              </span>
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="text-slate-400">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </Listbox.Button>
          
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl bg-white py-2 text-base shadow-xl ring-1 ring-black/5 focus:outline-none sm:text-sm">
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  className={({ active }) =>
                    `relative cursor-default select-none py-2.5 pl-4 pr-4 transition-colors ${
                      active ? 'bg-violet-50 text-violet-700' : 'text-slate-900'
                    }`
                  }
                  value={option.value}
                >
                  {({ selected }) => (
                    <div className="flex items-center">
                      {selected && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-1 rounded-r-full bg-[#8C52FF]" />
                      )}
                      <span className={`block truncate pl-2 ${selected ? 'font-semibold text-[#8C52FF]' : 'font-normal'}`}>
                        {option.label}
                      </span>
                    </div>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  )
}
