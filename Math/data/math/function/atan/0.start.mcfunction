data remove storage math: ans
data modify storage math: internal.sign set compute default float math:sign
data modify storage math: internal.abs set compute default float {type:"abs",input:{type:"storage",storage:"math:",path:"a"}}
data modify storage math: internal.x set from storage math: internal.abs
execute if predicate math:atan_sub run data modify storage math: internal.x set compute default float {type:"div",left:1,right:{type:"storage",storage:"math:",path:"internal.abs"}}
data modify storage math: internal.result set compute default float math:atan
execute if predicate math:atan_sub run data modify storage math: internal.result set compute default float {type:"sub",left:1.5707963267948966192313216916398,right:{type:"storage",storage:"math:",path:"internal.result"}}
data modify storage math: ans set compute default float {type:"mul",inputs:[{type:"storage",storage:"math:",path:"internal.result"},{type:"storage",storage:"math:",path:"internal.sign"}]}
data remove storage math: internal
