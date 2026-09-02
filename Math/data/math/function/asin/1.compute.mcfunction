
execute if predicate math:asin_out_of_range run return run data modify storage math: ans set value 0f
execute if predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"a"},test:0} run return run data modify storage math: ans set value 0f

data modify storage math: internal.sign set compute default float math:sign
data modify storage math: internal.abs set compute default float {type:"abs",input:{type:"storage",storage:"math:",path:"a"}}
data modify storage math: internal.x set compute default float {type:"sqrt",input:{type:"sub",left:1,right:{type:"storage",storage:"math:",path:"internal.abs"}}}
data modify storage math: internal.result set compute default float math:asin
data modify storage math: internal.result set compute default float {type:"sub",left:1.5707963267948966192313216916398,right:{type:"storage",storage:"math:",path:"internal.result"}}

