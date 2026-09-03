
execute if predicate math:quaternion_to_axis_angle/acos_out_of_range run return run data modify storage math: ans set value 0f

data modify storage math: internal.sign set compute default float math:sign
data modify storage math: internal.abs set compute default float {type:"abs",input:{type:"storage",storage:"math:",path:"rotation[3]"}}
data modify storage math: internal.x set compute default float {type:"sqrt",input:{type:"sub",left:1,right:{type:"storage",storage:"math:",path:"internal.abs"}}}
data modify storage math: internal.result set compute default float math:acos
execute if predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"internal.sign"},test:-1} run data modify storage math: internal.result set compute default float {type:"sub",left:3.1415926535897932384626433832795,right:{type:"storage",storage:"math:",path:"internal.result"}}

