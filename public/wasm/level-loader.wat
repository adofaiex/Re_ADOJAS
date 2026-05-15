(module
  (type (;0;) (func (param i32 i32 f64)))
  (type (;1;) (func (param f64) (result f64)))
  (type (;2;) (func (param i32 i32 i32)))
  (type (;3;) (func (param f64 f64) (result f64)))
  (type (;4;) (func (param i32 i32 i32 i32 i32 i32 i32 f64 f64 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (type (;5;) (func (result i32)))
  (func (;0;) (type 0) (param i32 i32 f64)
    local.get 0
    local.get 1
    i32.const 3
    i32.shl
    i32.add
    local.get 2
    f64.store)
  (func (;1;) (type 1) (param f64) (result f64)
    (local f64 f64 f64 i32 i32)
    local.get 0
    local.set 1
    local.get 0
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 2147483647
    i32.and
    local.tee 4
    i32.const 1141899264
    i32.ge_u
    if  ;; label = @1
      local.get 0
      local.get 0
      f64.ne
      if  ;; label = @2
        local.get 0
        return
      end
      f64.const 0x1.921fb54442d18p+0 (;=1.5708;)
      local.get 1
      f64.copysign
      return
    end
    local.get 4
    i32.const 1071382528
    i32.lt_u
    if  ;; label = @1
      local.get 4
      i32.const 1044381696
      i32.lt_u
      if  ;; label = @2
        local.get 0
        return
      end
      i32.const -1
      local.set 5
    else
      local.get 0
      f64.abs
      local.set 0
      local.get 4
      i32.const 1072889856
      i32.lt_u
      if (result f64)  ;; label = @2
        local.get 4
        i32.const 1072037888
        i32.lt_u
        if (result f64)  ;; label = @3
          local.get 0
          local.get 0
          f64.add
          f64.const -0x1p+0 (;=-1;)
          f64.add
          local.get 0
          f64.const 0x1p+1 (;=2;)
          f64.add
          f64.div
        else
          i32.const 1
          local.set 5
          local.get 0
          f64.const -0x1p+0 (;=-1;)
          f64.add
          local.get 0
          f64.const 0x1p+0 (;=1;)
          f64.add
          f64.div
        end
      else
        local.get 4
        i32.const 1073971200
        i32.lt_u
        if (result f64)  ;; label = @3
          i32.const 2
          local.set 5
          local.get 0
          f64.const -0x1.8p+0 (;=-1.5;)
          f64.add
          local.get 0
          f64.const 0x1.8p+0 (;=1.5;)
          f64.mul
          f64.const 0x1p+0 (;=1;)
          f64.add
          f64.div
        else
          i32.const 3
          local.set 5
          f64.const -0x1p+0 (;=-1;)
          local.get 0
          f64.div
        end
      end
      local.set 0
    end
    local.get 0
    local.get 0
    f64.mul
    local.tee 3
    local.get 3
    f64.mul
    local.set 2
    local.get 0
    local.get 3
    local.get 2
    local.get 2
    local.get 2
    local.get 2
    local.get 2
    f64.const 0x1.0ad3ae322da11p-6 (;=0.0162858;)
    f64.mul
    f64.const 0x1.97b4b24760debp-5 (;=0.0497688;)
    f64.add
    f64.mul
    f64.const 0x1.10d66a0d03d51p-4 (;=0.0666107;)
    f64.add
    f64.mul
    f64.const 0x1.745cdc54c206ep-4 (;=0.0909089;)
    f64.add
    f64.mul
    f64.const 0x1.24924920083ffp-3 (;=0.142857;)
    f64.add
    f64.mul
    f64.const 0x1.555555555550dp-2 (;=0.333333;)
    f64.add
    f64.mul
    local.get 2
    local.get 2
    local.get 2
    local.get 2
    local.get 2
    f64.const -0x1.2b4442c6a6c2fp-5 (;=-0.0365316;)
    f64.mul
    f64.const -0x1.dde2d52defd9ap-5 (;=-0.0583357;)
    f64.add
    f64.mul
    f64.const -0x1.3b0f2af749a6dp-4 (;=-0.0769188;)
    f64.add
    f64.mul
    f64.const -0x1.c71c6fe231671p-4 (;=-0.111111;)
    f64.add
    f64.mul
    f64.const -0x1.999999998ebc4p-3 (;=-0.2;)
    f64.add
    f64.mul
    f64.add
    f64.mul
    local.set 2
    local.get 5
    i32.const 0
    i32.lt_s
    if  ;; label = @1
      local.get 0
      local.get 2
      f64.sub
      return
    end
    block (result f64)  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 5
                br_table 1 (;@5;) 2 (;@4;) 3 (;@3;) 4 (;@2;) 0 (;@6;)
              end
              unreachable
            end
            f64.const 0x1.dac670561bb4fp-2 (;=0.463648;)
            local.get 2
            f64.const -0x1.a2b7f222f65e2p-56 (;=-2.26988e-17;)
            f64.add
            local.get 0
            f64.sub
            f64.sub
            br 3 (;@1;)
          end
          f64.const 0x1.921fb54442d18p-1 (;=0.785398;)
          local.get 2
          f64.const -0x1.1a62633145c07p-55 (;=-3.06162e-17;)
          f64.add
          local.get 0
          f64.sub
          f64.sub
          br 2 (;@1;)
        end
        f64.const 0x1.f730bd281f69bp-1 (;=0.982794;)
        local.get 2
        f64.const -0x1.007887af0cbbdp-56 (;=-1.39033e-17;)
        f64.add
        local.get 0
        f64.sub
        f64.sub
        br 1 (;@1;)
      end
      f64.const 0x1.921fb54442d18p+0 (;=1.5708;)
      local.get 2
      f64.const -0x1.1a62633145c07p-54 (;=-6.12323e-17;)
      f64.add
      local.get 0
      f64.sub
      f64.sub
    end
    local.get 1
    f64.copysign)
  (func (;2;) (type 2) (param i32 i32 i32)
    local.get 0
    local.get 1
    i32.const 2
    i32.shl
    i32.add
    local.get 2
    i32.store)
  (func (;3;) (type 3) (param f64 f64) (result f64)
    (local i32 i32 i32 i32 i64 i64)
    local.get 0
    local.get 0
    f64.ne
    local.get 1
    local.get 1
    f64.ne
    i32.or
    if  ;; label = @1
      local.get 1
      local.get 0
      f64.add
      return
    end
    local.get 0
    i64.reinterpret_f64
    local.tee 6
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    local.set 5
    local.get 1
    i64.reinterpret_f64
    local.tee 7
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    local.tee 4
    i32.const 1072693248
    i32.sub
    local.get 7
    i32.wrap_i64
    local.tee 3
    i32.or
    i32.eqz
    if  ;; label = @1
      local.get 0
      call 1
      return
    end
    local.get 4
    i32.const 30
    i32.shr_u
    i32.const 2
    i32.and
    local.get 5
    i32.const 31
    i32.shr_u
    i32.or
    local.set 2
    local.get 5
    i32.const 2147483647
    i32.and
    local.tee 5
    local.get 6
    i32.wrap_i64
    i32.or
    i32.eqz
    if  ;; label = @1
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            local.get 2
            i32.eqz
            local.get 2
            i32.const 1
            i32.eq
            i32.or
            i32.eqz
            if  ;; label = @5
              local.get 2
              i32.const 2
              i32.eq
              br_if 1 (;@4;)
              local.get 2
              i32.const 3
              i32.eq
              br_if 2 (;@3;)
              br 3 (;@2;)
            end
            local.get 0
            return
          end
          f64.const 0x1.921fb54442d18p+1 (;=3.14159;)
          return
        end
        f64.const -0x1.921fb54442d18p+1 (;=-3.14159;)
        return
      end
    end
    block  ;; label = @1
      local.get 4
      i32.const 2147483647
      i32.and
      local.tee 4
      local.get 3
      i32.or
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      i32.const 2146435072
      i32.eq
      if  ;; label = @2
        local.get 5
        i32.const 2146435072
        i32.eq
        if (result f64)  ;; label = @3
          f64.const 0x1.2d97c7f3321d2p+1 (;=2.35619;)
          f64.const 0x1.921fb54442d18p-1 (;=0.785398;)
          local.get 2
          i32.const 2
          i32.and
          select
          local.tee 0
          f64.neg
          local.get 0
          local.get 2
          i32.const 1
          i32.and
          select
        else
          f64.const 0x1.921fb54442d18p+1 (;=3.14159;)
          f64.const 0x0p+0 (;=0;)
          local.get 2
          i32.const 2
          i32.and
          select
          local.tee 0
          f64.neg
          local.get 0
          local.get 2
          i32.const 1
          i32.and
          select
        end
        return
      end
      local.get 5
      i32.const 2146435072
      i32.eq
      local.get 4
      i32.const 67108864
      i32.add
      local.get 5
      i32.lt_u
      i32.or
      br_if 0 (;@1;)
      local.get 5
      i32.const 67108864
      i32.add
      local.get 4
      i32.lt_u
      i32.const 0
      local.get 2
      i32.const 2
      i32.and
      select
      if (result f64)  ;; label = @2
        f64.const 0x0p+0 (;=0;)
      else
        local.get 0
        local.get 1
        f64.div
        f64.abs
        call 1
      end
      local.set 0
      block  ;; label = @2
        block  ;; label = @3
          block  ;; label = @4
            block  ;; label = @5
              block  ;; label = @6
                local.get 2
                br_table 0 (;@6;) 1 (;@5;) 2 (;@4;) 3 (;@3;) 4 (;@2;)
              end
              local.get 0
              return
            end
            local.get 0
            f64.neg
            return
          end
          f64.const 0x1.921fb54442d18p+1 (;=3.14159;)
          local.get 0
          f64.const -0x1.1a62633145c07p-53 (;=-1.22465e-16;)
          f64.add
          f64.sub
          return
        end
        local.get 0
        f64.const -0x1.1a62633145c07p-53 (;=-1.22465e-16;)
        f64.add
        f64.const -0x1.921fb54442d18p+1 (;=-3.14159;)
        f64.add
        return
      end
      unreachable
    end
    f64.const -0x1.921fb54442d18p+0 (;=-1.5708;)
    f64.const 0x1.921fb54442d18p+0 (;=1.5708;)
    local.get 2
    i32.const 1
    i32.and
    select)
  (func (;4;) (type 4) (param i32 i32 i32 i32 i32 i32 i32 f64 f64 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32) (result i32)
    (local f64 f64 f64 f64 f64 f64 f64 f64 f64 f64 i32 i32 i32 i32 i32)
    local.get 1
    i32.const 2
    i32.lt_s
    if  ;; label = @1
      i32.const 0
      return
    end
    local.get 1
    i32.const 1
    i32.sub
    local.set 32
    i32.const 1
    local.set 31
    loop  ;; label = @1
      local.get 29
      local.get 32
      i32.lt_s
      if  ;; label = @2
        f64.const 0x0p+0 (;=0;)
        local.set 20
        loop  ;; label = @3
          local.get 6
          local.get 30
          i32.gt_s
          if (result i32)  ;; label = @4
            local.get 29
            local.get 3
            local.get 30
            i32.const 2
            i32.shl
            i32.add
            i32.load
            i32.eq
          else
            i32.const 0
          end
          if  ;; label = @4
            local.get 5
            local.get 30
            i32.const 24
            i32.mul
            i32.add
            f64.load
            local.set 19
            local.get 4
            local.get 30
            i32.const 2
            i32.shl
            i32.add
            i32.load
            local.tee 33
            if  ;; label = @5
              local.get 33
              i32.const 1
              i32.eq
              if  ;; label = @6
                local.get 7
                local.get 19
                f64.mul
                local.set 7
              else
                local.get 33
                i32.const 2
                i32.eq
                if  ;; label = @7
                  local.get 19
                  local.set 7
                else
                  local.get 20
                  local.get 19
                  f64.const 0x1p-1 (;=0.5;)
                  f64.mul
                  f64.add
                  local.get 20
                  local.get 33
                  i32.const 3
                  i32.eq
                  select
                  local.set 20
                end
              end
            else
              local.get 31
              i32.eqz
              local.set 31
            end
            local.get 30
            i32.const 1
            i32.add
            local.set 30
            br 1 (;@3;)
          end
        end
        local.get 11
        local.get 29
        local.get 31
        call 2
        local.get 12
        local.get 29
        local.get 7
        call 0
        local.get 0
        local.get 29
        i32.const 1
        i32.shl
        local.tee 33
        i32.const 3
        i32.shl
        i32.add
        f64.load
        local.set 24
        local.get 0
        local.get 33
        i32.const 1
        i32.add
        i32.const 3
        i32.shl
        i32.add
        f64.load
        local.set 25
        local.get 0
        local.get 29
        i32.const 1
        i32.add
        i32.const 4
        i32.shl
        i32.add
        f64.load
        local.set 19
        local.get 0
        local.get 33
        i32.const 3
        i32.add
        i32.const 3
        i32.shl
        i32.add
        f64.load
        local.set 21
        f64.const 0x1.68p+7 (;=180;)
        local.get 2
        local.get 29
        i32.const 3
        i32.shl
        i32.add
        f64.load
        local.tee 26
        local.get 26
        f64.const 0x0p+0 (;=0;)
        f64.eq
        select
        f64.const 0x1.1df46a2529d39p-6 (;=0.0174533;)
        f64.mul
        local.tee 26
        f64.neg
        local.get 26
        local.get 31
        select
        local.tee 26
        local.get 20
        local.get 20
        f64.add
        f64.const 0x1.921fb54442d18p+1 (;=3.14159;)
        f64.mul
        local.tee 27
        f64.sub
        local.get 26
        local.get 27
        f64.add
        local.get 31
        select
        local.tee 27
        f64.abs
        f64.const 0x1.921fb54442d18p+2 (;=6.28319;)
        f64.div
        local.tee 26
        local.get 26
        f64.add
        f64.const 0x1.ep+5 (;=60;)
        local.get 7
        f64.div
        f64.mul
        local.set 28
        local.get 13
        local.get 29
        local.get 29
        if (result f64)  ;; label = @3
          local.get 0
          local.get 33
          i32.const 1
          i32.sub
          i32.const 3
          i32.shl
          i32.add
          f64.load
          local.get 25
          f64.sub
          local.get 0
          local.get 29
          i32.const 1
          i32.sub
          i32.const 4
          i32.shl
          i32.add
          f64.load
          local.get 24
          f64.sub
          call 3
        else
          local.get 8
          f64.const 0x1.68p+7 (;=180;)
          f64.add
          f64.const 0x1.1df46a2529d39p-6 (;=0.0174533;)
          f64.mul
        end
        call 0
        local.get 14
        local.get 29
        local.get 27
        call 0
        local.get 18
        local.get 29
        local.get 22
        local.get 26
        f64.add
        local.tee 22
        call 0
        local.get 10
        local.get 29
        local.get 28
        call 0
        local.get 9
        local.get 29
        local.get 23
        local.get 28
        f64.add
        local.tee 23
        call 0
        local.get 15
        local.get 29
        local.get 29
        i32.const 0
        i32.gt_s
        if (result f64)  ;; label = @3
          local.get 0
          local.get 29
          i32.const 1
          i32.sub
          i32.const 4
          i32.shl
          i32.add
          f64.load
          local.get 24
          f64.sub
          local.tee 26
          local.get 26
          f64.mul
          local.get 0
          local.get 29
          i32.const 1
          i32.shl
          i32.const 1
          i32.sub
          i32.const 3
          i32.shl
          i32.add
          f64.load
          local.get 25
          f64.sub
          local.tee 26
          local.get 26
          f64.mul
          f64.add
          f64.sqrt
        else
          f64.const 0x1p+0 (;=1;)
        end
        call 0
        local.get 16
        local.get 29
        local.get 19
        local.get 24
        f64.sub
        local.tee 19
        local.get 19
        f64.mul
        local.get 21
        local.get 25
        f64.sub
        local.tee 19
        local.get 19
        f64.mul
        f64.add
        f64.sqrt
        call 0
        local.get 17
        local.get 29
        local.get 20
        call 0
        local.get 29
        i32.const 1
        i32.add
        local.set 29
        br 1 (;@1;)
      end
    end
    loop  ;; label = @1
      local.get 6
      local.get 30
      i32.gt_s
      if  ;; label = @2
        local.get 5
        local.get 30
        i32.const 24
        i32.mul
        i32.add
        f64.load
        local.set 8
        local.get 4
        local.get 30
        i32.const 2
        i32.shl
        i32.add
        i32.load
        local.tee 0
        if  ;; label = @3
          local.get 7
          local.get 8
          f64.mul
          local.get 8
          local.get 7
          local.get 0
          i32.const 2
          i32.eq
          select
          local.get 0
          i32.const 1
          i32.eq
          select
          local.set 7
        else
          local.get 31
          i32.eqz
          local.set 31
        end
        local.get 30
        i32.const 1
        i32.add
        local.set 30
        br 1 (;@1;)
      end
    end
    local.get 11
    local.get 1
    i32.const 1
    i32.sub
    local.tee 0
    local.get 31
    call 2
    local.get 12
    local.get 0
    local.get 7
    call 0
    local.get 17
    local.get 0
    f64.const 0x0p+0 (;=0;)
    call 0
    local.get 32)
  (func (;5;) (type 5) (result i32)
    i32.const 0)
  (memory (;0;) 0)
  (export "precompute" (func 4))
  (export "dummy" (func 5))
  (export "memory" (memory 0)))
