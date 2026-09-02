
execute if predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"b"},test:0} run return run function math:atan2/2.x_zero


data modify storage math: internal.a_abs set compute default float {type:"abs",input:{type:"storage",storage:"math:",path:"a"}}
data modify storage math: internal.b_abs set compute default float {type:"abs",input:{type:"storage",storage:"math:",path:"b"}}
data modify storage math: internal.x set compute default float {type:"div",left:{type:"min",inputs:[{type:"storage",storage:"math:",path:"internal.a_abs"},{type:"storage",storage:"math:",path:"internal.b_abs"}]},right:{type:"max",inputs:[{type:"storage",storage:"math:",path:"internal.a_abs"},{type:"storage",storage:"math:",path:"internal.b_abs"}]}}
data modify storage math: internal.result set compute default float math:atan

execute unless predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"internal.a_abs"},test:{max:{type:"storage",storage:"math:",path:"internal.b_abs"}}} run \
  data modify storage math: internal.result set compute default float {type:"sub",left:1.5707963267948966192313216916398,right:{type:"storage",storage:"math:",path:"internal.result"}}


execute unless predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"b"},test:{min:0}} run \
  data modify storage math: internal.result set compute default float {type:"sub",left:3.1415926535897932384626433832795,right:{type:"storage",storage:"math:",path:"internal.result"}}


execute unless predicate {type:"float_value_check",value:{type:"storage",storage:"math:",path:"a"},test:{min:0}} run \
  data modify storage math: internal.result set compute default float {type:"mul",inputs:[-1,{type:"storage",storage:"math:",path:"internal.result"}]}

