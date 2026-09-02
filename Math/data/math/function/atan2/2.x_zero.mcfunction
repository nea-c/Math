
execute if predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"a"},test:0} run return run data modify storage math: ans set value 0f
execute if predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"a"},test:{min:0}} run return run data modify storage math: ans set value 1.5707963267948966192313216916398f
data modify storage math: ans set value -1.5707963267948966192313216916398f
