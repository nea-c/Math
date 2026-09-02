data remove storage math: ans
function math:acos/1.compute
data modify storage math: ans set compute default float {type:"mul",inputs:[{type:"storage",storage:"math:",path:"internal.result"},1]}
data remove storage math: internal
