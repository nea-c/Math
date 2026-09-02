data remove storage math: ans
function math:asin/1.compute
data modify storage math: ans set compute default float {type:"mul",inputs:[{type:"storage",storage:"math:",path:"internal.result"},{type:"storage",storage:"math:",path:"internal.sign"}]}
data remove storage math: internal
